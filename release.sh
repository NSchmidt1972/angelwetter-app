#!/bin/bash

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Bitte gib eine Version an (z. B. ./release.sh 0.1.2)"
  exit 1
fi

# Änderungen committen, falls vorhanden
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "💄 Committing uncommitted changes..."
  git add .
  git commit -m "💄 Vorbereitungen für Version $VERSION"
else
  echo "✅ Keine offenen Änderungen – direkt zur Versionierung"
fi

echo "🚀 Erstelle Release-Version $VERSION ..."
npm version "$VERSION" || exit 1

# Generiere Changelog
echo "📝 Erstelle Changelog-Eintrag für $VERSION ..."  
LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
COMMITS=$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s")

DATE=$(date +%Y-%m-%d)
echo -e "\n## [$VERSION] - $DATE\n### Änderungen\n$COMMITS" >> CHANGELOG.md

# Changelog committen
git add CHANGELOG.md
git commit -m "📝 Update CHANGELOG für Version $VERSION"

# Push commit + tag
git push origin main
git push origin "v$VERSION"

# GitHub Release erstellen per API
REPO="NSchmidt1972/angelwetter-app"
TAG="v$VERSION"
RELEASE_DATA=$(jq -n \
  --arg tag "$TAG" \
  --arg name "Version $VERSION" \
  --arg body "$COMMITS" \
  '{ tag_name: $tag, name: $name, body: $body, draft: false, prerelease: false }'
)

echo "📤 Veröffentliche Release auf GitHub ..."
curl -s -X POST https://api.github.com/repos/$REPO/releases \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RELEASE_DATA"

echo "✅ GitHub Release $TAG wurde erstellt."
echo "✅ Version $VERSION + Changelog veröffentlicht!"
