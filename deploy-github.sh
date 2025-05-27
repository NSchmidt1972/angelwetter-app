#!/bin/bash

# Name für den Commit mit Datum und Uhrzeit
COMMIT_MSG="🚀 Update vom $(date +'%d.%m.%Y %H:%M')"

echo "📦 Änderungen werden zu GitHub übertragen ..."

# Änderungen hinzufügen
git add .

# Commit mit Nachricht
git commit -m "$COMMIT_MSG"

# Push zu GitHub
git push

echo "✅ Erfolgreich gepusht: $COMMIT_MSG"
