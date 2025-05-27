#!/bin/bash

# Beispiel: ./release.sh 1.2.0

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Bitte gib eine Version an (z. B. ./release.sh 1.2.0)"
  exit 1
fi

echo "🚀 Erstelle Release-Version $VERSION ..."

# Version in package.json setzen (inkl. Commit + Git-Tag)
npm version "$VERSION"

# Änderungen + Tag zu GitHub pushen
git push origin main
git push origin "v$VERSION"

echo "✅ Version $VERSION veröffentlicht und zu GitHub gepusht."
echo "🔗 Jetzt kannst du auf GitHub ein Release aus dem Tag erstellen, falls gewünscht."
