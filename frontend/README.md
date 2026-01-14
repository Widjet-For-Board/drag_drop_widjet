# React File Manager Component

A customizable file manager component for React applications with drag and drop functionality.

## Features

- 📁 File and folder management
- 🖱️ Drag and drop support
- 📤 File upload/download
- 🗑️ Delete files and folders
- ✏️ Rename files and folders
- 📱 Responsive design

## Installation

```bash
npm install @yourusername/react-file-manager
# or
yarn add @yourusername/react-file-manager
```

## Usage

```jsx
import React from 'react';
import { FileManager } from '@yourusername/react-file-manager';

function App() {
  const handleFileSelect = (file) => {
    console.log('Selected file:', file);
  };

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <FileManager 
        apiUrl="http://your-api-url.com/api"
        onFileSelect={handleFileSelect}
      />
    </div>
  );
}

export default App;
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiUrl` | string | Yes | Base URL for the file management API |
| `onFileSelect` | function | No | Callback when a file is selected |
| `theme` | object | No | Custom theme object for styling |
| `allowedFileTypes` | string[] | No | Array of allowed file types (e.g., ['image/*', '.pdf']) |
| `maxFileSize` | number | No | Maximum file size in bytes (default: 10MB) |

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## Publishing

1. Update the version in `package.json`
2. Build the package:
   ```bash
   npm run build
   ```
3. Publish to npm:
   ```bash
   npm publish --access public
   ```

## License

MIT © [Your Name](https://github.com/yourusername)
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
