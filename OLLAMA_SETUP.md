# Installation et Configuration d'Ollama

Ce guide explique comment installer et configurer Ollama sur votre VPS pour remplacer OpenAI dans la génération de recettes.

## Prérequis

- VPS avec au moins 8GB RAM et 4+ cœurs CPU
- Accès SSH au serveur
- Docker et Docker Compose installés (recommandé)

## ⚡ Installation rapide avec Docker Compose (Recommandé)

Si votre application utilise Docker Compose, Ollama est déjà configuré dans `docker-compose.yml` :

```bash
# Télécharger le modèle après le démarrage
docker-compose up -d ollama

# Attendre que le conteneur soit prêt (quelques secondes)
sleep 10

# Télécharger le modèle (depuis le conteneur)
docker exec 4epices_ollama ollama pull llama3.2:3b

# Vérifier que tout fonctionne
docker exec 4epices_ollama ollama list
```

Les variables d'environnement sont déjà configurées dans `docker-compose.yml` :
- `OLLAMA_URL=http://ollama:11434` (nom du service Docker)
- `OLLAMA_MODEL=llama3.2:3b`
- `AI_PROVIDER=ollama`

## Installation manuelle (si vous n'utilisez pas Docker)

## Installation d'Ollama

### Option 1 : Installation directe (recommandée)

```bash
# Télécharger et installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Vérifier l'installation
ollama --version
```

### Option 2 : Installation via Docker

```bash
# Créer un conteneur Ollama
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# Vérifier que le conteneur tourne
docker ps | grep ollama
```

## Télécharger un modèle

Pour un VPS avec 8GB RAM, nous recommandons un modèle léger :

```bash
# Modèle recommandé : llama3.2:3b (3GB, rapide, bon pour JSON)
ollama pull llama3.2:3b

# Alternatives (selon vos besoins) :
# ollama pull mistral:7b        # 4GB, meilleure qualité
# ollama pull llama3.1:8b       # 4.7GB, excellente qualité mais plus lent
```

## Démarrer Ollama en service

### Avec systemd (installation directe)

```bash
# Créer le service systemd
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

# Activer et démarrer le service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Vérifier le statut
sudo systemctl status ollama
```

### Avec Docker (déjà géré par Docker)

Le conteneur Docker redémarre automatiquement si configuré avec `--restart=always`.

## Configuration dans l'application

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` du frontend (ou dans votre système de déploiement) :

```env
# Provider IA (ollama ou openai)
AI_PROVIDER=ollama

# URL Ollama (par défaut : http://localhost:11434)
# Si Ollama est sur le même serveur que votre app : http://localhost:11434
# Si Ollama est sur un autre serveur : http://IP_DU_SERVEUR:11434
OLLAMA_URL=http://localhost:11434

# Modèle Ollama à utiliser (par défaut : llama3.2:3b)
OLLAMA_MODEL=llama3.2:3b

# OpenAI (optionnel, pour fallback)
OPENAI_API_KEY=sk-...  # Gardez cette clé si vous voulez un fallback
```

### Si Ollama est sur un autre serveur

Si votre application Next.js tourne sur un serveur différent de celui où Ollama est installé :

1. **Exposer Ollama via un reverse proxy** (recommandé pour la sécurité) :

```nginx
# Exemple avec Nginx
server {
    listen 80;
    server_name ollama.votre-domaine.com;

    location / {
        proxy_pass http://localhost:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

2. **Ou configurer le firewall** pour autoriser l'accès :

```bash
# Autoriser le port 11434 depuis votre serveur d'application
sudo ufw allow from IP_SERVEUR_APP to any port 11434
```

3. **Mettre à jour OLLAMA_URL** :

```env
OLLAMA_URL=http://IP_OU_DOMAINE_OLLAMA:11434
```

## Tester l'installation

### Test depuis le serveur

```bash
# Tester Ollama directement
ollama run llama3.2:3b "Bonjour, peux-tu me répondre en JSON avec une clé 'message' ?"
```

### Test depuis l'application

1. Redémarrez votre application Next.js
2. Allez sur la page de création de recette
3. Dictez une recette
4. Cliquez sur "Créer le JSON avec l'IA"
5. Vérifiez les logs pour voir si Ollama est utilisé

## Monitoring et maintenance

### Vérifier l'utilisation de la RAM

```bash
# Voir l'utilisation mémoire d'Ollama
ps aux | grep ollama

# Voir l'utilisation globale
free -h
```

### Redémarrer Ollama

```bash
# Si installé directement
sudo systemctl restart ollama

# Si en Docker
docker restart ollama
```

### Mettre à jour Ollama

```bash
# Si installé directement
curl -fsSL https://ollama.com/install.sh | sh

# Si en Docker
docker pull ollama/ollama
docker restart ollama
```

## Dépannage

### Ollama ne répond pas

1. Vérifier que le service tourne :
   ```bash
   sudo systemctl status ollama
   # ou
   docker ps | grep ollama
   ```

2. Vérifier les logs :
   ```bash
   sudo journalctl -u ollama -f
   # ou
   docker logs ollama
   ```

3. Vérifier que le port 11434 est accessible :
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Erreur "Connection refused"

- Vérifiez que `OLLAMA_URL` pointe vers le bon serveur
- Vérifiez que le firewall autorise les connexions
- Vérifiez que Ollama écoute sur le bon port

### Modèle non trouvé

```bash
# Lister les modèles disponibles
ollama list

# Si le modèle n'existe pas, le télécharger
ollama pull llama3.2:3b
```

### Performance lente

- Utilisez un modèle plus petit (llama3.2:3b au lieu de llama3.1:8b)
- Vérifiez l'utilisation CPU/RAM du serveur
- Considérez augmenter les ressources du VPS

## Fallback vers OpenAI

Si Ollama est configuré mais échoue, l'application basculera automatiquement vers OpenAI si `OPENAI_API_KEY` est configurée.

Pour forcer l'utilisation d'OpenAI uniquement :

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Sécurité

⚠️ **Important** : Par défaut, Ollama écoute sur toutes les interfaces (0.0.0.0). Pour la production :

1. **Utilisez un reverse proxy** (Nginx, Traefik) avec authentification
2. **Ou limitez l'accès** au firewall pour n'autoriser que votre serveur d'application
3. **Ne pas exposer** Ollama directement sur Internet sans protection

## Ressources

- Documentation Ollama : https://ollama.com/docs
- Modèles disponibles : https://ollama.com/library
- GitHub : https://github.com/ollama/ollama
