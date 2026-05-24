# 🎲 Droop's Dice - Hexatronus OS v1.1

![Hexatronus Banner](https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&q=80&w=1200&h=400)

> "Onde destinos são forjados em faces de resina e magia."

**Droop's Dice** é o sistema definitivo de distribuição de atributos para RPGistas que levam a sério a integridade da sua mesa. Construído sob o núcleo **Hexatronus OS**, ele oferece um fluxo controlado, estético e inviolável para a criação de heróis lendários.

## 🔮 Funcionalidades Arcanas

-   **Algoritmo 4d6 Drop Lowest**: Rolagens puras seguindo as leis ancestrais da 5ª Edição.
-   **Escrutínio do Mestre**: Nenhuma alma entra no plano sem a validação imediata do regente da mesa.
-   **Alquimia de Atributos**: Interface tátil e mística para distribuir seus pontos com precisão cirúrgica.
-   **Ancestralidade Integrada**: Cálculos automáticos de bônus raciais baseados em sua linhagem.
-   **Interface Responsiva**: Do smartphone ao monitor ultra-wide do mestre, o ritual permanece intacto.
-   **Vínculo d'Alma**: Integração com Google Auth para garantir que sua ficha pertença apenas a você.

## 🛠️ Forja Técnica

Este artefato foi construído utilizando:
- **Vue 3 + Vite**: O motor de renderização mais veloz do multiverso.
- **Tailwind CSS**: Estilização baseada em utilitários para um design brutalista-arcano.
- **Firebase Firestore**: Persistência de dados em tempo real através dos planos.
- **Pinia**: Gerenciamento de estado sincronizado.
- **Lucide Icons**: Glifos digitais cristalinos.

---

## 🚀 Ritual de Implantação (Deployment)

### 1. Forja em Contentores (DevContainer) 🐳

Para um ambiente de desenvolvimento isolado e idêntico à produção:
- Abra o repositório no VS Code.
- Clique em **"Reopen in Container"** quando solicitado.
- O ambiente instalará automaticamente o Node, extensões recomendadas (Vue, Tailwind) e as dependências do projeto.

---

### 2. Configuração das Runas (Segurança & CI/CD) 🔒

Para que o deploy automático funcione, você **NÃO** deve subir seu arquivo `.env`. Em vez disso:
1. Vá nas configurações do seu repositório no GitHub: `Settings > Secrets and variables > Actions`.
2. Adicione cada variável como um **Repository Secret** (ex: `VITE_FIREBASE_API_KEY`).
3. O workflow do GitHub Actions (`deploy.yml`) injetará esses segredos automaticamente durante a forja da versão de produção.

Para desenvolvimento local manual:
- Crie um arquivo `.env` na raiz (ele está no `.gitignore` por segurança).

### 3. Transcendência para GitHub Pages

Para publicar seu ritual no GitHub Pages, siga estes passos:

1.  **Configure o Repo**: No `package.json`, certifique-se de que o nome do projeto está correto.
2.  **Manifesto Automático**: O arquivo `.github/workflows/deploy.yml` já está pronto. Toda vez que você der `push` na branch `main`, o ritual de deploy será iniciado automaticamente.
3.  **Manual (Opcional)**: Caso prefira a intervenção manual:
    ```bash
    npm run deploy
    ```
4.  **Ajuste Final**: No GitHub, vá em *Settings > Pages* e verifique se a fonte está definida como a branch `gh-pages`.

## 📜 Licença

Distribuído sob a Licença de Uso Arcano. Use para o bem, use para o caos, mas nunca trapaceie sem um propósito narrativo.

---
*Hexatronus System Core v1.1 - Desenvolvido nas profundezas das masmorras digitais.*
