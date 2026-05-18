import errno
import ipaddress
import os
import platform
import shutil
import socket
import socketserver
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from django.conf import settings
from django.core.management.base import CommandError
from django.core.management.commands.runserver import Command as DjangoRunserverCommand
from django.core.servers import basehttp
from django.db import connections
from django.utils import autoreload


DEV_CERT_DIR = Path(settings.BASE_DIR) / ".devcerts"
DEV_CA_CERT_PATH = DEV_CERT_DIR / "enertech-dev-ca.pem"
DEV_CA_KEY_PATH = DEV_CERT_DIR / "enertech-dev-ca.key"
DEV_SERVER_CERT_PATH = DEV_CERT_DIR / "enertech-dev-server.pem"
DEV_SERVER_KEY_PATH = DEV_CERT_DIR / "enertech-dev-server.key"
DEV_CA_FINGERPRINT_PATH = DEV_CERT_DIR / "enertech-dev-ca.sha256"


class HTTPSWSGIServer(basehttp.WSGIServer):
    ssl_context = None

    def __init__(self, *args, ssl_context=None, **kwargs):
        self.ssl_context = ssl_context or getattr(self, "ssl_context", None)
        super().__init__(*args, **kwargs)
        if self.ssl_context is not None:
            self.socket = self.ssl_context.wrap_socket(self.socket, server_side=True)


def _write_pem_file(path: Path, content: bytes) -> None:
    path.write_bytes(content)


def _generate_dev_certificates() -> None:
    DEV_CERT_DIR.mkdir(parents=True, exist_ok=True)

    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)

    ca_name = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "Enertech Dev CA"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Enertech"),
        ]
    )
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key=ca_key, algorithm=hashes.SHA256())
    )

    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_name = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Enertech"),
        ]
    )
    server_cert = (
        x509.CertificateBuilder()
        .subject_name(server_name)
        .issuer_name(ca_name)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=825))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.DNSName("127.0.0.1"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                    x509.IPAddress(ipaddress.IPv6Address("::1")),
                ]
            ),
            critical=False,
        )
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),
            critical=False,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key=ca_key, algorithm=hashes.SHA256())
    )

    _write_pem_file(
        DEV_CA_KEY_PATH,
        ca_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ),
    )
    _write_pem_file(DEV_CA_CERT_PATH, ca_cert.public_bytes(serialization.Encoding.PEM))
    _write_pem_file(
        DEV_SERVER_KEY_PATH,
        server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ),
    )
    _write_pem_file(
        DEV_SERVER_CERT_PATH,
        server_cert.public_bytes(serialization.Encoding.PEM)
        + ca_cert.public_bytes(serialization.Encoding.PEM),
    )


def _ensure_dev_certificates() -> None:
    if not all(
        path.exists()
        for path in (
            DEV_CA_CERT_PATH,
            DEV_CA_KEY_PATH,
            DEV_SERVER_CERT_PATH,
            DEV_SERVER_KEY_PATH,
        )
    ):
        _generate_dev_certificates()


def _ensure_trusted_root_ca() -> None:
    if platform.system().lower() != "windows":
        return

    if shutil.which("certutil") is None:
        return

    ca_fingerprint = x509.load_pem_x509_certificate(DEV_CA_CERT_PATH.read_bytes()).fingerprint(
        hashes.SHA256()
    ).hex()

    if DEV_CA_FINGERPRINT_PATH.exists() and DEV_CA_FINGERPRINT_PATH.read_text().strip() == ca_fingerprint:
        return

    result = subprocess.run(
        ["certutil", "-user", "-addstore", "root", str(DEV_CA_CERT_PATH)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise CommandError(
            "Nao foi possivel registrar a CA local no Windows. "
            f"certutil retornou {result.returncode}: {result.stderr.strip() or result.stdout.strip()}"
        )

    DEV_CA_FINGERPRINT_PATH.write_text(ca_fingerprint)


def _build_ssl_context() -> ssl.SSLContext:
    _ensure_dev_certificates()
    _ensure_trusted_root_ca()

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile=str(DEV_SERVER_CERT_PATH), keyfile=str(DEV_SERVER_KEY_PATH))
    return context


class Command(DjangoRunserverCommand):
    help = "Starts the Enertech development server over HTTPS."
    protocol = "https"

    def run(self, **options):
        use_reloader = options["use_reloader"]

        if use_reloader:
            autoreload.run_with_reloader(self.inner_run_https, **options)
        else:
            self.inner_run_https(None, **options)

    def inner_run_https(self, *args, **options):
        autoreload.raise_last_exception()

        threading = options["use_threading"]
        shutdown_message = options.get("shutdown_message", "")

        if not options["skip_checks"]:
            self.stdout.write("Performing system checks...\n\n")
            check_kwargs = super().get_check_kwargs(options)
            check_kwargs["display_num_errors"] = True
            self.check(**check_kwargs)

        self.check_migrations()

        for conn in connections.all(initialized_only=True):
            conn.close()

        try:
            handler = self.get_handler(*args, **options)
            ssl_context = _build_ssl_context()
            https_server_cls = type(
                "HTTPSWSGIServer",
                (HTTPSWSGIServer,),
                {"ssl_context": ssl_context},
            )

            basehttp.run(
                self.addr,
                int(self.port),
                handler,
                ipv6=self.use_ipv6,
                threading=threading,
                on_bind=self.on_bind,
                server_cls=https_server_cls,
            )
        except OSError as exc:
            errors = {
                errno.EACCES: "You don't have permission to access that port.",
                errno.EADDRINUSE: "That port is already in use.",
                errno.EADDRNOTAVAIL: "That IP address can't be assigned to.",
            }
            try:
                error_text = errors[exc.errno]
            except KeyError:
                error_text = exc
            self.stderr.write(f"Error: {error_text}")
            os._exit(1)
        except KeyboardInterrupt:
            if shutdown_message:
                self.stdout.write(shutdown_message)
            sys.exit(0)