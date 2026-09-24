import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';

// Incrusta presets.shared.json (los presets que el equipo guardó en el
// artifact) en el bloque #shared-presets, para que el build normal y el
// del artifact arranquen con los mismos presets compartidos.
function sharedPresets() {
  return {
    name: 'shared-presets',
    transformIndexHtml(html) {
      const file = new URL('./presets.shared.json', import.meta.url);
      if (!existsSync(file)) return html;
      const json = JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))).replace(/</g, '\\u003c');
      return html.replace(
        /(<script type="application\/json" id="shared-presets">)[\s\S]*?(<\/script>)/,
        (_, open, close) => open + json + close
      );
    },
  };
}

export default defineConfig({
  plugins: [sharedPresets(), viteSingleFile()],
});
