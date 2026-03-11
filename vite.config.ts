import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync, copyFileSync } from 'fs';

// Base64-encoded minimal PNG icons (blue squares with white 'S')
const iconData = {
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABSdEVYdENvcHlyaWdodABDQyBBdHRyaWJ1dGlvbi1TaGFyZUFsaWtlIGh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL2xpY2Vuc2VzL2J5LXNhLzQuMC/DVGIFAAAAQklEQVQ4jWNgGAWjYBTQBDAyMjL8//+f4f///0xk6GPi4OD4z8HBQZaxLCwsDP///2fEJc7ExPA/KirqP7kGEAsAcS4bEuL2TsIAAAAASUVORK5CYII=',
  48: 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABSdEVYdENvcHlyaWdodABDQyBBdHRyaWJ1dGlvbi1TaGFyZUFsaWtlIGh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL2xpY2Vuc2VzL2J5LXNhLzQuMC/DVGIFAAAAZklEQVRoge3ZMQrAIBBEUfH+h7YXm4BgYRkYeK9X3W+xTQEAALDFrLy8qurS+ay8fHe+JHHnwzMv7+4e+vJ/GMDdPdS9vLsDAACsUO2FEyc0mpvQyE1oZAoBAACsUO2FEyfEBx9EGxLI26y7AAAAAElFTkSuQmCC',
  128: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABSdEVYdENvcHlyaWdodABDQyBBdHRyaWJ1dGlvbi1TaGFyZUFsaWtlIGh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL2xpY2Vuc2VzL2J5LXNhLzQuMC/DVGIFAAAAtklEQVR4nO3ZMQrEMBAEQcn//zOvkwUGB0KwUlVm6NVrZh4zc2bmY/516Z2Xl+/OlyTufHjm5d3dQ1/+DwO4u4e6l3d3AAAAVqj2wokTGs1NaOQmNDKFAAAAVqj2wokT4oMPog0JmEIAAABWqPbCiRPigw+iDQmYQgAAAFao9sKJE+KDD6INCZhCAAAAVqj2wokT4oMPog0JmEIAAABWqPbCiRPigw+iDQmYQgAAAFao9sKJE+KDD6INCXwBe0QbEsjR5X0AAAAASUVORK5CYII='
};

// Custom plugin to copy manifest and icons
const copyManifest = () => {
  return {
    name: 'copy-manifest',
    closeBundle: () => {
      // Ensure dist directory exists
      try {
        mkdirSync('dist');
      } catch (e) {
        // Directory might already exist
      }

      // Copy manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');

      // Create icons directory
      try {
        mkdirSync('dist/icons');
      } catch (e) {
        // Directory might already exist
      }

      // Create icon files
      Object.entries(iconData).forEach(([size, data]) => {
        writeFileSync(
          `dist/icons/icon${size}.png`,
          Buffer.from(data, 'base64')
        );
      });
    }
  };
};

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), copyManifest()],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        content: 'src/content.tsx',
        background: 'src/background.ts'
      },
      output: {
        entryFileNames: '[name].js'
      }
    },
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  },
});