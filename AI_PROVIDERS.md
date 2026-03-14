# Configuration des Providers IA

Ce guide explique comment configurer différents providers IA pour la génération de recettes.

## 🚀 Groq (Recommandé - Gratuit et Rapide)

### Avantages
- ✅ **Gratuit** jusqu'à 30 requêtes/min
- ✅ **Très rapide** (infrastructure dédiée)
- ✅ **Modèles performants** (Llama 3.1 70B, Mixtral)
- ✅ **Qualité proche de GPT-4**

### Configuration

1. **Créer un compte** : https://console.groq.com
2. **Générer une clé API** : https://console.groq.com/keys
3. **Configurer les variables d'environnement** :

```env
# Dans votre .env ou docker-compose.yml
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile  # Modèle recommandé (gratuit)
```

### Modèles disponibles

- `llama-3.3-70b-versatile` : **Recommandé** - Très performant, gratuit (remplace llama-3.1-70b-versatile)
- `llama-3.1-8b-instant` : Plus rapide, moins performant
- `mixtral-8x7b-32768` : Bon compromis vitesse/qualité

### Limites

- 30 requêtes/min en gratuit
- Pas de limite de tokens en gratuit

---

## 🤖 OpenAI (Payant mais Excellent)

### Avantages
- ✅ **Meilleure qualité** (GPT-4)
- ✅ **Très fiable**
- ✅ **Support JSON natif**

### Configuration

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Coût

- GPT-4o-mini : ~$0.15/1M tokens (input), $0.60/1M tokens (output)
- Quota gratuit : $5 au démarrage

---

## 🦙 Ollama (Local, Gratuit mais Limité)

### Avantages
- ✅ **100% gratuit** (pas de quota)
- ✅ **Données locales** (confidentialité)
- ✅ **Pas de dépendance externe**

### Inconvénients

- ❌ **Qualité inférieure** aux services cloud
- ❌ **Plus lent** (dépend du hardware)
- ❌ **Nécessite un VPS dédié**

### Configuration

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://ollama:11434  # Si Docker
OLLAMA_MODEL=llama3.1:8b
```

---

## 🧠 Anthropic Claude (Alternative Premium)

### Avantages
- ✅ **Excellente qualité**
- ✅ **Bon rapport qualité/prix**
- ✅ **Quota gratuit** ($5)

### Configuration

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

### Coût

- Claude 3 Haiku : ~$0.25/1M tokens (input), $1.25/1M tokens (output)
- Quota gratuit : $5 au démarrage

---

## 🔄 Système de Fallback

Le système essaie automatiquement les providers dans cet ordre :

1. **Groq** (si configuré)
2. **Ollama** (si configuré)
3. **OpenAI** (si configuré)

Si un provider échoue, le système bascule automatiquement vers le suivant.

---

## Configuration dans Docker Compose

### Exemple avec Groq

```yaml
frontend:
  environment:
    AI_PROVIDER: groq
    GROQ_API_KEY: ${GROQ_API_KEY}
    GROQ_MODEL: llama-3.1-70b-versatile
    # Fallback optionnel
    OPENAI_API_KEY: ${OPENAI_API_KEY}
```

### Exemple avec OpenAI en priorité

```yaml
frontend:
  environment:
    AI_PROVIDER: openai
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    # Fallback vers Groq si OpenAI échoue
    GROQ_API_KEY: ${GROQ_API_KEY}
```

---

## Recommandation

Pour votre cas d'usage (génération de recettes avec JSON structuré) :

1. **Groq** : Meilleur choix - gratuit, rapide, qualité excellente
2. **OpenAI** : Si vous avez un budget et voulez la meilleure qualité
3. **Ollama** : Seulement si vous voulez absolument éviter les services cloud

---

## Test de Configuration

Après configuration, testez avec :

```bash
# Vérifier les logs
docker-compose logs -f frontend

# Tester une recette depuis l'interface
# Le log devrait indiquer quel provider est utilisé
```

Les logs afficheront : `[API /recipe/parse-ai] Réponse reçue de groq` (ou openai, ollama)
