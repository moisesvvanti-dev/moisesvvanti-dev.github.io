# Configuração de Domínio no Netlify (Resolvendo erro de Login)

Se você estiver recebendo o erro "Não foi possível realizar o login" ao acessar o site pelo Netlify, siga estes passos para autorizar o domínio no Firebase.

## 🛠️ Passo a Passo

1.  Aceda ao [Console do Firebase](https://console.firebase.google.com/).
2.  Selecione o seu projeto (**Streamhub Alpha** ou o nome configurado).
3.  No menu lateral, vá em **Authentication** > **Settings** (Configurações).
4.  Clique na aba **Authorized Domains** (Domínios Autorizados).
5.  Clique em **Add domain** (Adicionar domínio).
6.  Cole a URL do seu site no Netlify (exemplo: `seu-site.netlify.app`).
7.  Clique em **Add** (Adicionar).

---
> [!TIP]
> Também é recomendável adicionar o domínio em **Google Cloud Console** > **APIs & Services** > **Credentials** na seção "Authorized JavaScript origins", caso o erro persista.
