const React = require('react');
const { render } = require('ink');
const { MarkdownRenderer } = require('./dist/ui/utils/markdown-renderer');

const complexMarkdown = `# Amélioration du Rendu Markdown ✅

Le nouveau renderer **markdown personnalisé** fonctionne parfaitement avec :

## Fonctionnalités supportées

- Titres de **différents niveaux** sans symboles # indésirables
- Texte en *italique* et **gras** correctement formaté  
- \`Code inline\` avec coloration jaune
- Listes à puces avec des • propres

### Blocs de code avec syntax highlighting

\`\`\`javascript
function improvedMarkdown() {
  console.log("Markdown sanitisé pour terminal !");
  return "Beaucoup mieux qu'avant";
}
\`\`\`

> Les citations sont bien indentées et stylisées
> comme prévu pour un rendu terminal optimal

**Avantages :**
- Plus de symboles # disgracieux 
- Largeur adaptée au terminal
- Coloration avec Ink/React
- Word wrapping intelligent pour les longues lignes qui pourraient déborder du terminal et rendre la lecture difficile

*Mission accomplie !* 🎉`;

function TestApp() {
  return React.createElement(MarkdownRenderer, { content: complexMarkdown });
}

render(React.createElement(TestApp));