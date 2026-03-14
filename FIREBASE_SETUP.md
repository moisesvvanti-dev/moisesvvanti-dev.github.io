# Configuração do Firebase para Kazzi Store

Para que o sistema de login e o banco de dados funcionem corretamente na sua hospedagem/XAMPP, siga estes passos no [Console do Firebase](https://console.firebase.google.com/):

## 1. Regras do Realtime Database
Vá em **Realtime Database** > **Rules** e cole o seguinte código:

```json
{
  "rules": {
    "kazzi_products": {
      ".read": true,
      ".write": "auth != null && auth.token.email == 'moisesvanti@gmail.com'"
    },
    "kazzi_orders": {
      ".read": "auth != null && auth.token.email == 'moisesvanti@gmail.com'",
      ".write": true
    }
  }
}
```
> [!NOTE]
> Estas regras permitem que qualquer pessoa veja os produtos e faça pedidos, mas apenas o seu e-mail (`moisesvanti@gmail.com`) pode editar produtos ou ver os pedidos.

---

## 2. Domínios Autorizados (ERRO DE LOGIN)
O erro "Não foi possível realizar a autenticação" ou `auth/unauthorized-domain` acontece porque o domínio de onde você está acessando não está autorizado no Firebase.

1. Vá em **Authentication** > **Settings** > **Authorized Domains**.
2. Clique em **Add domain**.
3. Adicione conforme onde você está hospedando:
   - **Local**: `localhost`
   - **GitHub Pages**: `seu-usuario.github.io`
   - **Netlify**: `nome-do-seu-app.netlify.app`
   - **Domínio Próprio**: `meusite.com.br`

> [!WARNING]
> Sem isso, o login do Google **não funcionará** e exibirá uma mensagem de erro genérica.


---

## 3. Ativar Login do Google
1. Vá em **Authentication** > **Sign-in method**.
2. Clique em **Add new provider**.
3. Selecione **Google** e ative-o.
4. Configure o e-mail de suporte do projeto.

---

## 4. Chaves de API
Certifique-se de que a sua **API Key** nas configurações do projeto não tem restrições que impeçam o uso do domínio atual.
