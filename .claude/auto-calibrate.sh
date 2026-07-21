#!/usr/bin/env bash
# Auto-calibration effort + modèle selon la complexité du prompt.
# Hook UserPromptSubmit : s'exécute avant chaque réponse Claude.
# - Injecte additionalContext (effet immédiat sur le comportement)
# - Écrit model + effortLevel dans settings.local.json (effet au tour suivant)

set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
WORD_COUNT=$(echo "$PROMPT" | wc -w | tr -d ' ')

# ── Matrice de classification ────────────────────────────────────────────────
# Règles testées du plus fort au plus faible pour éviter les faux positifs.

TIER=""

# XHIGH — audit, architecture, migrations, tâches multi-fichiers de fond
if echo "$PROMPT" | grep -iEq \
  "audit|architecture|refactor|restructur|migration|sécurité|securit|performance|optimis.*(complet|global|tout|app)|analyse complète|tous les fichiers|plan (de|d'|d )"; then
  TIER="xhigh"

# HIGH — nouvelles fonctionnalités non triviales, explications profondes
elif echo "$PROMPT" | grep -iEq \
  "implémente|implémenter|crée un système|nouveau système|ajoute (une fonctionnalité|un système)|comment fonctionne|explique (en détail|pourquoi|comment)|compare|différence entre|conçoi"; then
  TIER="high"

# LOW — corrections ponctuelles, questions directes, micro-tâches
elif echo "$PROMPT" | grep -iEq \
  "corrige|fixe|bug|typo|renomme|déplace|change juste|remplace|quel est|où est|donne.?moi|montre.?moi|affiche|liste|seed|compte|version"; then
  TIER="low"

# LOW — prompt très court (question flash)
elif [ "$WORD_COUNT" -lt 8 ]; then
  TIER="low"

# MEDIUM — tout le reste
else
  TIER="medium"
fi

# ── Table effort / modèle / comportement ────────────────────────────────────
case "$TIER" in
  xhigh)
    EFFORT="xhigh"
    MODEL="claude-sonnet-4-6"
    MODEL_LABEL="Sonnet · effort max"
    INSTRUCTIONS="Tâche complexe et multi-dimensionnelle. Procède méthodiquement : analyse d'abord, planifie, puis exécute. Explore tous les angles et cas limites. Préfère la qualité à la vitesse."
    ;;
  high)
    EFFORT="high"
    MODEL="claude-sonnet-4-6"
    MODEL_LABEL="Sonnet · effort élevé"
    INSTRUCTIONS="Fonctionnalité ou explication substantielle. Structure ta réponse, justifie tes choix techniques, anticipe les questions de suivi."
    ;;
  low)
    EFFORT="low"
    MODEL="claude-haiku-4-5-20251001"
    MODEL_LABEL="Haiku · effort minimal"
    INSTRUCTIONS="Tâche simple et ciblée. Réponse directe sans sur-explication. Va droit au but, maximum 3 phrases de contexte."
    ;;
  *)
    EFFORT="medium"
    MODEL="claude-sonnet-4-6"
    MODEL_LABEL="Sonnet · effort standard"
    INSTRUCTIONS="Réponse équilibrée : complète sur les points importants, concise sur le reste."
    ;;
esac

# ── Mise à jour settings.local.json (prend effet au tour suivant) ────────────
SETTINGS="$(dirname "$0")/settings.local.json"
if [ -f "$SETTINGS" ]; then
  UPDATED=$(jq \
    --arg e "$EFFORT" \
    --arg m "$MODEL" \
    '.effortLevel = $e | .model = $m' \
    "$SETTINGS")
  echo "$UPDATED" > "$SETTINGS"
fi

# ── Sortie JSON pour Claude Code ─────────────────────────────────────────────
jq -n \
  --arg tier "$TIER" \
  --arg effort "$EFFORT" \
  --arg label "$MODEL_LABEL" \
  --arg instr "$INSTRUCTIONS" \
  '{
    "systemMessage": ("⚡ \($label) | complexité \($tier) | effort \($effort)"),
    "hookSpecificOutput": {
      "hookEventName": "UserPromptSubmit",
      "additionalContext": ("[AUTO-CALIBRATION | complexité=\($tier)] \($instr)")
    }
  }'
