#!/bin/bash

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Bitte gib eine Version an (z. B. ./release.sh 0.1.2)"
  exit 1
fi

# 🔐 Prüfe GitHub-Token
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN ist nicht gesetzt. Bitte exportiere ihn zuerst."
  exit 1
fi

# 🧰 Prüfe jq
if ! command -v jq &> /dev/null; then
  echo "❌ jq ist nicht installiert. Bitte installiere es mit: sudo apt install jq"
  exit 1
fi

# 💾 Änderungen committen, falls vorhanden
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "💄 Committe offene Änderungen..."
  git add .
  git commit -m "💄 Vorbereitungen für Version $VERSION"
else
  echo "✅ Keine offenen Änderungen – weiter zur Versionierung"
fi

echo "🚀 Setze Version auf $VERSION ..."
npm version "$VERSION" || exit 1

# 📝 Changelog erzeugen
echo "📝 Aktualisiere CHANGELOG.md ..."
LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
COMMITS=$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s")

DATE=$(date +%Y-%m-%d)
echo -e "\n## [$VERSION] - $DATE\n### Änderungen\n$COMMITS" >> CHANGELOG.md

git add CHANGELOG.md
git commit -m "📝 Update CHANGELOG für Version $VERSION"

# ⬆️ Push zur GitHub-Repo
git push origin main
git push origin "v$VERSION"

# 📦 Release via GitHub-API erstellen
REPO="NSchmidt1972/angelwetter-app"
TAG="v$VERSION"
RELEASE_DATA=$(jq -n \
  --arg tag "$TAG" \
  --arg name "Version $VERSION" \
  --arg body "$COMMITS" \
  '{ tag_name: $tag, name: $name, body: $body, draft: false, prerelease: false }'
)

echo "📤 Veröffentliche Release auf GitHub ..."

RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/release_response.txt -X POST "https://api.github.com/repos/$REPO/releases" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RELEASE_DATA")

HTTP_CODE=$(tail -n1 <<< "$RESPONSE")

echo "🔍 GitHub API Antwort: HTTP $HTTP_CODE"
cat /tmp/release_response.txt

if [[ "$HTTP_CODE" == "201" ]]; then
  echo "✅ GitHub Release $TAG erfolgreich veröffentlicht!"
else
  echo "⚠️ Fehler beim Erstellen des Releases. Siehe oben für Details."
fi

echo "🎉 Release-Prozess für Version $VERSION abgeschlossen."
