# Kazzi Company — Configuração Firebase (OBRIGATÓRIO)

Sem estas configurações o cadastro não funciona.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 1 — Firestore Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.firebase.google.com
→ Firestore Database → Criar banco → Modo produção

Aba **Rules** — cole e publique:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kazzi_products/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in [
          'moisesvvanti@gmail.com',
          'kazzicompany@gmail.com'
        ];
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 2 — Firebase Storage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.firebase.google.com
→ Storage → Começar → Modo produção

Aba **Rules** — cole e publique:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /kazzi_produtos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email in [
          'moisesvvanti@gmail.com',
          'kazzicompany@gmail.com'
        ];
    }
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 3 — Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Authentication → Sign-in method → Google → Ativar

→ Authentication → Settings → Authorized domains → Adicionar:
  zicompany.netlify.app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PASSO 4 — Índice composto (opcional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Na primeira vez que abrir a loja, pode aparecer um erro no console
do browser com um link para criar o índice. Clique no link.

Ou crie manualmente:
→ Firestore → Indexes → Add index:
  Collection: kazzi_products
  Fields: ativo ASC + criado DESC
  Scope: Collection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Deploy no Netlify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arraste a pasta kazzi_netlify/ para app.netlify.com/drop
OU conecte ao GitHub.
