# Kazzi Company — Configuração Firebase e GitHub Pages (OBRIGATÓRIO)

Sem estas configurações, o cadastro não funciona e as imagens *não* serão enviadas para o seu repositório oficial. Nós atualizamos a aplicação para rodar 100% via GitHub Pages com envio automático de novas fotos pela API do GitHub!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 1 — Firestore Database (Firebase)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Acesse console.firebase.google.com
→ Vá em **Firestore Database** → Criar banco → Modo produção

Na aba **Rules** — cole e publique:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kazzi_products/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 2 — Authentication via GitHub (Firebase)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Como as fotos agora vão direto para a pasta `produtos/` do seu GitHub de forma automática pelo painel, precisamos vincular o Firebase com o GitHub.

No **Firebase Console**:
1. Vá em **Authentication** → **Sign-in method**.
2. Adicione **GitHub** e ative.
3. Deixe a página do Firebase aberta (copie o `Authorization callback URL`).

No **GitHub** (Abra em nova aba):
1. Vá nas suas configurações de desenvolvedor: `https://github.com/settings/developers`
2. Em **OAuth Apps**, clique em **New OAuth App**.
3. Preencha os dados:
   - Identificação / Nome: Kazzi Admin
   - Homepage URL: `https://moisesvvanti-dev.github.io`
   - Authorization callback URL: (Cole o link fornecido pelo Firebase)
4. Gere o **Client ID** e o **Client Secret** copiando ambos de volta para o Firebase Console e clique em Salvar.

Volte ao Firebase:
→ Em **Authentication** → **Settings** → **Authorized domains**:
   Adicione o domínio `moisesvvanti-dev.github.io` (se ele já não estiver lá).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 3 — Firebase Storage (Regras)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nós alteramos os uploads pesados para irem direto pro GitHub, mas ainda mantemos essa regra global caso seja usada no futuro.
No Console → Storage → Aba **Rules**, cole:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 4 — Como Cadastrar no Painel Admin (Tudo Pronto!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Acesse o URL do seu painel Admin oficial: `https://moisesvvanti-dev.github.io/admin/`
2. Clique em **ENTRAR COM GITHUB**. (Isso fará o login e enviará o token de acesso ocultamente para os uploads do repositório).
3. Vá em "Cadastrar", selecione qualquer imagem ou vídeo do seu celular/PC e clique em Salvar.
4. A foto e os dados irão para o repositório da loja online *imediatamente* sem envolver XAMPP nem FTP!

---
> Nota técnica: Devido o cache agressivo de algumas URLs, o `firebase.js` do painel inclui o gatilho `?v=2` para invalidar caches antigos, e as imagens dos produtos agora carregam pela URL real da branch principal do GitHub Pages diretamente para os convidados.
