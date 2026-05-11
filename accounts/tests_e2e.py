import json

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import Agendamento, Avaliacao, Conector, Ponto


@override_settings(DEBUG=True, SECURE_SSL_REDIRECT=False)
class AccountsE2ETests(TestCase):
    """Fluxos ponta a ponta usando rotas reais, sessao e banco de teste."""

    def setUp(self):
        self.user_password = "SenhaForte123!"
        self.user = User.objects.create_user(
            username="cliente",
            email="cliente@example.com",
            password=self.user_password,
        )
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminForte123!",
            is_staff=True,
        )
        self.ponto = Ponto.objects.create(
            nome="Eletroposto Centro",
            latitude=-3.7319,
            longitude=-38.5267,
            consumo=12.5,
            preco_start=2.0,
            preco_kwh=1.5,
            preco_ociosidade=3.0,
            horario_abertura="08:00",
            horario_fechamento="20:00",
            tipos_carregador="tipo2,ccs2",
        )
        Conector.objects.create(
            ponto=self.ponto,
            tipo="tipo2",
            potencia=22,
            status="livre",
        )

    def post_json(self, url_name, payload, *args):
        return self.client.post(
            reverse(url_name, args=args),
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_public_user_registers_then_logs_in_and_logs_out(self):
        register_page_response = self.client.get(reverse("register"))

        self.assertNotContains(register_page_response, 'id="onboardingModal"')

        register_response = self.client.post(
            reverse("register"),
            {
                "username": "novo_cliente",
                "email": "novo@example.com",
                "password": "NovaSenha123!",
                "confirm_password": "NovaSenha123!",
            },
            follow=True,
        )

        self.assertRedirects(register_response, reverse("home"))
        self.assertTrue(User.objects.filter(username="novo_cliente").exists())
        self.assertFalse("_auth_user_id" in self.client.session)
        self.assertContains(register_response, "Enertech")

        login_response = self.client.post(
            reverse("login"),
            {"username": "novo_cliente", "password": "NovaSenha123!"},
            follow=True,
        )

        self.assertRedirects(login_response, reverse("home"))
        self.assertEqual(self.client.session["_auth_user_id"], str(User.objects.get(username="novo_cliente").id))
        self.assertContains(login_response, "novo_cliente")

        logout_response = self.client.post(reverse("logout"), follow=True)

        self.assertRedirects(logout_response, reverse("login"))
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_auth_pages_enable_scroll_layout(self):
        login_response = self.client.get(reverse("login"))
        register_response = self.client.get(reverse("register"))

        self.assertContains(login_response, '<html lang="pt-br" class="auth-page">', html=False)
        self.assertContains(login_response, '<body class="auth-page">', html=False)
        self.assertContains(register_response, '<html lang="pt-br" class="auth-page">', html=False)
        self.assertContains(register_response, '<body class="auth-page">', html=False)

    def test_password_strength_endpoint_guides_registration_flow(self):
        weak_response = self.post_json("validar_senha", {"password": "abc"})
        strong_response = self.post_json("validar_senha", {"password": "SenhaForte123!"})

        self.assertEqual(weak_response.status_code, 200)
        self.assertEqual(weak_response.json()["forca"], "fraca")
        self.assertFalse(weak_response.json()["valida"])

        self.assertEqual(strong_response.status_code, 200)
        self.assertEqual(strong_response.json()["forca"], "forte")
        self.assertTrue(strong_response.json()["valida"])
        self.assertTrue(all(strong_response.json()["requisitos"].values()))

    def test_authenticated_user_reviews_schedules_and_cancels_charge(self):
        self.assertTrue(self.client.login(username="cliente", password=self.user_password))

        review_response = self.post_json(
            "avaliar_ponto",
            {"estrelas": 5, "comentario": "Funcionou muito bem."},
            self.ponto.id,
        )
        reviews_response = self.client.get(reverse("get_avaliacoes", args=[self.ponto.id]))
        schedule_response = self.post_json(
            "criar_agendamento",
            {
                "ponto_id": self.ponto.id,
                "data_inicio": "2099-05-08T10:00:00+00:00",
                "tempo_estimado": 60,
                "energia_solicitada": 20,
            },
        )

        self.assertEqual(review_response.status_code, 200)
        self.assertEqual(review_response.json()["status"], "criada")
        self.assertTrue(Avaliacao.objects.filter(ponto=self.ponto, usuario=self.user).exists())

        self.assertEqual(reviews_response.status_code, 200)
        self.assertEqual(reviews_response.json()["minha_avaliacao"]["estrelas"], 5)

        self.assertEqual(schedule_response.status_code, 200)
        self.assertEqual(schedule_response.json()["status"], "sucesso")
        agendamento = Agendamento.objects.get(id=schedule_response.json()["agendamento_id"])
        self.assertEqual(agendamento.usuario, self.user)
        self.assertEqual(agendamento.valor_estimado, 35.0)

        my_schedules_response = self.client.get(reverse("meus_agendamentos"))
        self.assertEqual(my_schedules_response.status_code, 200)
        self.assertEqual(len(my_schedules_response.json()["agendamentos"]), 1)

        cancel_response = self.client.post(reverse("cancelar_agendamento", args=[agendamento.id]))
        agendamento.refresh_from_db()

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.json()["status"], "sucesso")
        self.assertEqual(agendamento.status, "cancelado")

    def test_admin_creates_updates_and_removes_charging_point(self):
        self.assertTrue(self.client.login(username="admin", password="AdminForte123!"))

        create_response = self.post_json(
            "salvar_ponto",
            {
                "nome": "Eletroposto Aldeota",
                "lat": -3.7421,
                "lng": -38.4924,
                "consumo": 30,
                "preco_start": 1,
                "preco_kwh": 2,
                "preco_ociosidade": 4,
                "horario_abertura": "07:00",
                "horario_fechamento": "22:00",
                "tipos_carregador": ["tipo2", "ccs2"],
                "conectores": [
                    {"tipo": "tipo2", "potencia": 22},
                    {"tipo": "ccs2", "potencia": 50},
                ],
            },
        )

        self.assertEqual(create_response.status_code, 200)
        ponto_id = create_response.json()["id"]
        ponto = Ponto.objects.get(id=ponto_id)
        self.assertEqual(ponto.conectores.count(), 2)

        availability_response = self.post_json(
            "atualizar_disponibilidade",
            {
                "conectores": [
                    {"status": "ocupado"},
                    {"status": "livre"},
                ]
            },
            ponto_id,
        )
        ponto.refresh_from_db()

        self.assertEqual(availability_response.status_code, 200)
        self.assertTrue(availability_response.json()["success"])
        self.assertEqual(ponto.vagas_livres(), 1)

        delete_response = self.client.post(reverse("remover_ponto", args=[ponto_id]))

        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "removido")
        self.assertFalse(Ponto.objects.filter(id=ponto_id).exists())

    def test_admin_agendamentos_renders_dashboard_not_table(self):
        self.assertTrue(self.client.login(username="admin", password="AdminForte123!"))

        response = self.client.get(reverse("admin_agendamentos"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<body class="logged agenda-admin-page">', html=False)
        self.assertContains(response, 'class="agenda-dashboard"')
        self.assertContains(response, 'id="kanbanBoard"')
        self.assertNotContains(response, '<table class="admin-table">')
