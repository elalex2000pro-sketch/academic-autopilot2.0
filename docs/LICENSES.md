# Auditoría de licencias de dependencias

Revisión local del 11 de noviembre de 2026, sobre el commit `3824597`. El proyecto declara que quiere usar GPL-3.0-or-later.

## Conclusión

**No se ha identificado una dependencia inequívocamente incompatible en las declaraciones revisadas. La auditoría no permite aún certificar todas las distribuciones y sus componentes, por lo que queda pendiente la decisión de incorporar `LICENSE`.** Una licencia desconocida no es prueba de incompatibilidad.

- CKEditor 5 y su adaptador React declaran GPL-2.0-or-later o una licencia comercial. GPL 2 o posterior permite elegir GPL 3. El código configura `licenseKey: "GPL"`. Las funciones premium y LTS requieren revisar sus propios términos. [Licencias de CKEditor](https://ckeditor.com/legal/ckeditor-licensing-options/).
- Los avisos `SEE LICENSE IN LICENSE.md` de CKEditor requieren consultar el archivo de cada paquete; el inventario mantiene la declaración original. Se han inspeccionado los textos de `ckeditor5-core`, `ckeditor5-react` y `ckeditor5-integrations-common`, que ofrecen GPL 2 o posterior o licencia comercial. No se han revisado individualmente todos los archivos y recursos de los 62 paquetes.
- `busboy` y `streamsearch` no declaran licencia en el lock ni en su package.json instalado; sus archivos `LICENSE` locales contienen el texto MIT. Se conserva la declaración faltante en la tabla y se indica esta evidencia.
- `psycopg2-binary` declara LGPL con excepción. La documentación de Psycopg especifica LGPL-3.0-or-later con excepción para OpenSSL; los binarios y bibliotecas incluidos en cada plataforma requieren inventario y avisos propios. [Licencia de Psycopg](https://www.psycopg.org/docs/license.html).
- MPL-2.0, CC-BY-4.0 y expresiones alternativas deben conservar sus avisos y condiciones; revisar en particular los archivos MPL y la posible cláusula de incompatibilidad con licencias secundarias. La FSF explica esta excepción para MPL. [Compatibilidad de licencias](https://www.gnu.org/licenses/license-compatibility.en.html).
- Los paquetes Electron, ejecutables, instaladores y bibliotecas nativas pueden incorporar componentes y avisos que no aparecen como entradas npm; falta contrastar los artefactos distribuidos para cada plataforma. Las licencias de fuentes, imágenes y contenido del repositorio no se deducen de las dependencias.

## Método y límites

Frontend y desktop: inventario completo de entradas `packages` de cada `package-lock.json`, incluyendo transitivas y desarrollo, con ruta para distinguir versiones anidadas. Se informa el campo de licencia declarado, no una verificación automática de todo su contenido. Backend: metadatos de las distribuciones instaladas en `.venv311`, con paquetes de desarrollo y posibles paquetes ajenos; no es un lock de producción ni garantiza el conjunto de otras plataformas. `requirements.txt` fija las dependencias directas, pero no todas las transitivas. No se instalaron herramientas ni paquetes para esta revisión. Se usó `importlib.metadata` y lectura local de los locks.

Opciones para cerrar las incertidumbres: generar un lock Python reproducible por plataforma; inspeccionar los archivos de licencia de cada paquete con licencia indirecta y los avisos y componentes incluidos en los instaladores; conservar atribuciones y textos exigidos; después verificar que se dispone de derechos de todas las contribuciones del proyecto y añadir GPL-3.0-or-later. Si se encuentra una incompatibilidad concreta, sustituir o aislar el componente tras evaluar su distribución, o conseguir una licencia alternativa del titular.

## Frontend y desktop: entradas de los locks

Cada ruta es relativa al directorio indicado. «No declarada» significa que no figura en el lock; no implica falta de licencia.

| Área | Ruta del paquete | Versión | Licencia declarada |
|---|---|---|---|
| frontend | `node_modules/@alloc/quick-lru` | 5.3.0 | MIT |
| frontend | `node_modules/@ckeditor/ckeditor5-adapter-ckfinder` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-alignment` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-autoformat` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-autosave` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-basic-styles` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-block-quote` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-bookmark` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-ckbox` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-ckfinder` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-clipboard` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-cloud-services` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-code-block` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-core` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-easy-image` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-editor-balloon` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-editor-classic` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-editor-decoupled` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-editor-inline` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-editor-multi-root` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-emoji` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-engine` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-enter` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-essentials` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-find-and-replace` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-font` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-fullscreen` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-heading` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-highlight` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-horizontal-line` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-html-embed` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-html-support` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-icons` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-image` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-indent` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-integrations-common` | 3.2.1 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-language` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-link` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-list` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-markdown-gfm` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-media-embed` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-mention` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-minimap` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-page-break` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-paragraph` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-paste-from-office` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-react` | 12.0.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-remove-format` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-restricted-editing` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-select-all` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-show-blocks` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-source-editing` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-special-characters` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-style` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-table` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-typing` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-ui` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-ui/node_modules/color-convert` | 3.1.0 | MIT |
| frontend | `node_modules/@ckeditor/ckeditor5-ui/node_modules/color-name` | 2.1.1 | MIT |
| frontend | `node_modules/@ckeditor/ckeditor5-undo` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-upload` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-utils` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-widget` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@ckeditor/ckeditor5-word-count` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/@emnapi/core` | 1.10.0 | MIT |
| frontend | `node_modules/@emnapi/runtime` | 1.10.0 | MIT |
| frontend | `node_modules/@emnapi/wasi-threads` | 1.2.1 | MIT |
| frontend | `node_modules/@eslint-community/eslint-utils` | 4.10.1 | MIT |
| frontend | `node_modules/@eslint-community/regexpp` | 4.12.2 | MIT |
| frontend | `node_modules/@eslint/eslintrc` | 2.1.4 | MIT |
| frontend | `node_modules/@eslint/js` | 8.57.1 | MIT |
| frontend | `node_modules/@humanwhocodes/config-array` | 0.13.0 | Apache-2.0 |
| frontend | `node_modules/@humanwhocodes/module-importer` | 1.0.1 | Apache-2.0 |
| frontend | `node_modules/@humanwhocodes/object-schema` | 2.0.3 | BSD-3-Clause |
| frontend | `node_modules/@isaacs/cliui` | 8.0.2 | ISC |
| frontend | `node_modules/@isaacs/cliui/node_modules/ansi-regex` | 6.4.0 | MIT |
| frontend | `node_modules/@isaacs/cliui/node_modules/strip-ansi` | 7.2.0 | MIT |
| frontend | `node_modules/@jridgewell/gen-mapping` | 0.3.13 | MIT |
| frontend | `node_modules/@jridgewell/resolve-uri` | 3.1.2 | MIT |
| frontend | `node_modules/@jridgewell/sourcemap-codec` | 1.6.0 | MIT |
| frontend | `node_modules/@jridgewell/trace-mapping` | 0.3.31 | MIT |
| frontend | `node_modules/@napi-rs/wasm-runtime` | 1.2.5 | MIT |
| frontend | `node_modules/@next/env` | 14.2.35 | MIT |
| frontend | `node_modules/@next/eslint-plugin-next` | 14.2.35 | MIT |
| frontend | `node_modules/@next/swc-darwin-arm64` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-darwin-x64` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-linux-arm64-gnu` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-linux-arm64-musl` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-linux-x64-gnu` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-linux-x64-musl` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-win32-arm64-msvc` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-win32-ia32-msvc` | 14.2.33 | MIT |
| frontend | `node_modules/@next/swc-win32-x64-msvc` | 14.2.33 | MIT |
| frontend | `node_modules/@nodelib/fs.scandir` | 2.1.5 | MIT |
| frontend | `node_modules/@nodelib/fs.stat` | 2.0.5 | MIT |
| frontend | `node_modules/@nodelib/fs.walk` | 1.2.8 | MIT |
| frontend | `node_modules/@nolyfill/is-core-module` | 1.0.39 | MIT |
| frontend | `node_modules/@pkgjs/parseargs` | 0.11.0 | MIT |
| frontend | `node_modules/@popperjs/core` | 2.11.8 | MIT |
| frontend | `node_modules/@radix-ui/primitive` | 1.2.0 | MIT |
| frontend | `node_modules/@radix-ui/react-checkbox` | 1.4.1 | MIT |
| frontend | `node_modules/@radix-ui/react-collection` | 1.2.0 | MIT |
| frontend | `node_modules/@radix-ui/react-compose-refs` | 1.1.5 | MIT |
| frontend | `node_modules/@radix-ui/react-context` | 1.3.0 | MIT |
| frontend | `node_modules/@radix-ui/react-direction` | 1.2.0 | MIT |
| frontend | `node_modules/@radix-ui/react-id` | 1.1.4 | MIT |
| frontend | `node_modules/@radix-ui/react-label` | 2.1.17 | MIT |
| frontend | `node_modules/@radix-ui/react-presence` | 1.1.11 | MIT |
| frontend | `node_modules/@radix-ui/react-primitive` | 2.2.0 | MIT |
| frontend | `node_modules/@radix-ui/react-progress` | 1.2.1 | MIT |
| frontend | `node_modules/@radix-ui/react-roving-focus` | 1.2.1 | MIT |
| frontend | `node_modules/@radix-ui/react-slot` | 1.5.0 | MIT |
| frontend | `node_modules/@radix-ui/react-tabs` | 1.2.1 | MIT |
| frontend | `node_modules/@radix-ui/react-use-callback-ref` | 1.1.5 | MIT |
| frontend | `node_modules/@radix-ui/react-use-controllable-state` | 1.3.0 | MIT |
| frontend | `node_modules/@radix-ui/react-use-effect-event` | 0.0.5 | MIT |
| frontend | `node_modules/@radix-ui/react-use-is-hydrated` | 0.1.3 | MIT |
| frontend | `node_modules/@radix-ui/react-use-layout-effect` | 1.1.4 | MIT |
| frontend | `node_modules/@radix-ui/react-use-size` | 1.1.5 | MIT |
| frontend | `node_modules/@remirror/core-constants` | 3.0.0 | MIT |
| frontend | `node_modules/@rtsao/scc` | 1.1.0 | MIT |
| frontend | `node_modules/@rushstack/eslint-patch` | 1.16.1 | MIT |
| frontend | `node_modules/@swc/counter` | 0.1.3 | Apache-2.0 |
| frontend | `node_modules/@swc/helpers` | 0.5.5 | Apache-2.0 |
| frontend | `node_modules/@tiptap/core` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-blockquote` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-bold` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-bubble-menu` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-bullet-list` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-code` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-code-block` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-document` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-dropcursor` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-floating-menu` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-gapcursor` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-hard-break` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-heading` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-history` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-horizontal-rule` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-italic` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-link` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-list-item` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-ordered-list` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-paragraph` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-strike` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-text` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-text-style` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/extension-underline` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/pm` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/react` | 2.27.3 | MIT |
| frontend | `node_modules/@tiptap/starter-kit` | 2.27.3 | MIT |
| frontend | `node_modules/@tybys/wasm-util` | 0.10.4 | MIT |
| frontend | `node_modules/@types/color-convert` | 2.0.4 | MIT |
| frontend | `node_modules/@types/color-name` | 1.1.5 | MIT |
| frontend | `node_modules/@types/d3-color` | 3.1.3 | MIT |
| frontend | `node_modules/@types/d3-drag` | 3.0.7 | MIT |
| frontend | `node_modules/@types/d3-interpolate` | 3.0.4 | MIT |
| frontend | `node_modules/@types/d3-selection` | 3.0.12 | MIT |
| frontend | `node_modules/@types/d3-transition` | 3.0.9 | MIT |
| frontend | `node_modules/@types/d3-zoom` | 3.0.9 | MIT |
| frontend | `node_modules/@types/debug` | 4.1.13 | MIT |
| frontend | `node_modules/@types/hast` | 3.0.5 | MIT |
| frontend | `node_modules/@types/json5` | 0.0.29 | MIT |
| frontend | `node_modules/@types/linkify-it` | 5.0.0 | MIT |
| frontend | `node_modules/@types/markdown-it` | 14.2.0 | MIT |
| frontend | `node_modules/@types/mdast` | 4.0.4 | MIT |
| frontend | `node_modules/@types/mdurl` | 2.0.0 | MIT |
| frontend | `node_modules/@types/ms` | 2.1.0 | MIT |
| frontend | `node_modules/@types/node` | 22.20.5 | MIT |
| frontend | `node_modules/@types/prop-types` | 15.7.15 | MIT |
| frontend | `node_modules/@types/react` | 18.3.31 | MIT |
| frontend | `node_modules/@types/react-dom` | 18.3.7 | MIT |
| frontend | `node_modules/@types/unist` | 3.0.3 | MIT |
| frontend | `node_modules/@types/use-sync-external-store` | 0.0.6 | MIT |
| frontend | `node_modules/@typescript-eslint/eslint-plugin` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore` | 7.0.12 | MIT |
| frontend | `node_modules/@typescript-eslint/parser` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/project-service` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/scope-manager` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/tsconfig-utils` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/type-utils` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/types` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/typescript-estree` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/typescript-estree/node_modules/balanced-match` | 4.0.4 | MIT |
| frontend | `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion` | 5.0.12 | MIT |
| frontend | `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch` | 10.2.6 | BlueOak-1.0.0 |
| frontend | `node_modules/@typescript-eslint/utils` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/visitor-keys` | 8.71.2 | MIT |
| frontend | `node_modules/@typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys` | 5.0.1 | Apache-2.0 |
| frontend | `node_modules/@ungap/structured-clone` | 1.4.0 | ISC |
| frontend | `node_modules/@unrs/resolver-binding-android-arm-eabi` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-android-arm64` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-darwin-arm64` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-darwin-x64` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-freebsd-x64` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-arm-gnueabihf` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-arm-musleabihf` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-arm64-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-arm64-musl` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-loong64-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-loong64-musl` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-ppc64-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-riscv64-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-riscv64-musl` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-s390x-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-x64-gnu` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-linux-x64-musl` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-openharmony-arm64` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-wasm32-wasi` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-win32-arm64-msvc` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-win32-ia32-msvc` | 1.12.2 | MIT |
| frontend | `node_modules/@unrs/resolver-binding-win32-x64-msvc` | 1.12.2 | MIT |
| frontend | `node_modules/@xyflow/react` | 12.12.1 | MIT |
| frontend | `node_modules/@xyflow/system` | 0.0.84 | MIT |
| frontend | `node_modules/acorn` | 8.19.0 | MIT |
| frontend | `node_modules/acorn-jsx` | 5.3.2 | MIT |
| frontend | `node_modules/ajv` | 6.15.0 | MIT |
| frontend | `node_modules/ansi-regex` | 5.0.1 | MIT |
| frontend | `node_modules/ansi-styles` | 4.3.0 | MIT |
| frontend | `node_modules/any-promise` | 1.3.0 | MIT |
| frontend | `node_modules/anymatch` | 3.1.3 | ISC |
| frontend | `node_modules/arg` | 5.0.2 | MIT |
| frontend | `node_modules/argparse` | 2.0.1 | Python-2.0 |
| frontend | `node_modules/aria-query` | 5.3.2 | Apache-2.0 |
| frontend | `node_modules/array-buffer-byte-length` | 1.0.2 | MIT |
| frontend | `node_modules/array-includes` | 3.2.0 | MIT |
| frontend | `node_modules/array.prototype.findlast` | 1.2.5 | MIT |
| frontend | `node_modules/array.prototype.findlastindex` | 1.2.6 | MIT |
| frontend | `node_modules/array.prototype.flat` | 1.3.3 | MIT |
| frontend | `node_modules/array.prototype.flatmap` | 1.3.3 | MIT |
| frontend | `node_modules/array.prototype.tosorted` | 1.1.4 | MIT |
| frontend | `node_modules/arraybuffer.prototype.slice` | 1.0.4 | MIT |
| frontend | `node_modules/ast-types-flow` | 0.0.8 | MIT |
| frontend | `node_modules/async-function` | 1.0.0 | MIT |
| frontend | `node_modules/autoprefixer` | 10.6.1 | MIT |
| frontend | `node_modules/available-typed-arrays` | 1.0.7 | MIT |
| frontend | `node_modules/axe-core` | 4.14.0 | MPL-2.0 |
| frontend | `node_modules/axobject-query` | 4.1.0 | Apache-2.0 |
| frontend | `node_modules/bail` | 2.0.2 | MIT |
| frontend | `node_modules/balanced-match` | 1.0.2 | MIT |
| frontend | `node_modules/base64-js` | 1.5.1 | MIT |
| frontend | `node_modules/baseline-browser-mapping` | 2.11.28 | Apache-2.0 |
| frontend | `node_modules/binary-extensions` | 2.3.0 | MIT |
| frontend | `node_modules/bl` | 4.1.0 | MIT |
| frontend | `node_modules/blurhash` | 2.0.5 | MIT |
| frontend | `node_modules/brace-expansion` | 1.1.21 | MIT |
| frontend | `node_modules/braces` | 3.0.3 | MIT |
| frontend | `node_modules/browserslist` | 4.29.3 | MIT |
| frontend | `node_modules/buffer` | 5.7.1 | MIT |
| frontend | `node_modules/busboy` | 1.6.0 | No declarada |
| frontend | `node_modules/call-bind` | 1.0.9 | MIT |
| frontend | `node_modules/call-bind-apply-helpers` | 1.0.2 | MIT |
| frontend | `node_modules/call-bound` | 1.0.4 | MIT |
| frontend | `node_modules/callsites` | 3.1.0 | MIT |
| frontend | `node_modules/camelcase-css` | 2.0.1 | MIT |
| frontend | `node_modules/caniuse-lite` | 1.0.30001816 | CC-BY-4.0 |
| frontend | `node_modules/canvas` | 3.2.3 | MIT |
| frontend | `node_modules/ccount` | 2.0.1 | MIT |
| frontend | `node_modules/chalk` | 4.1.2 | MIT |
| frontend | `node_modules/character-entities` | 2.0.2 | MIT |
| frontend | `node_modules/character-entities-html4` | 2.1.0 | MIT |
| frontend | `node_modules/character-entities-legacy` | 3.0.0 | MIT |
| frontend | `node_modules/chokidar` | 3.6.0 | MIT |
| frontend | `node_modules/chokidar/node_modules/glob-parent` | 5.1.2 | ISC |
| frontend | `node_modules/chownr` | 1.1.4 | ISC |
| frontend | `node_modules/ckeditor5` | 49.1.0 | SEE LICENSE IN LICENSE.md |
| frontend | `node_modules/class-variance-authority` | 0.7.1 | Apache-2.0 |
| frontend | `node_modules/classcat` | 5.0.5 | MIT |
| frontend | `node_modules/client-only` | 0.0.1 | MIT |
| frontend | `node_modules/clsx` | 2.1.1 | MIT |
| frontend | `node_modules/color-convert` | 2.0.1 | MIT |
| frontend | `node_modules/color-name` | 1.1.4 | MIT |
| frontend | `node_modules/color-parse` | 2.0.2 | MIT |
| frontend | `node_modules/color-parse/node_modules/color-name` | 2.1.1 | MIT |
| frontend | `node_modules/comma-separated-tokens` | 2.0.3 | MIT |
| frontend | `node_modules/commander` | 4.1.1 | MIT |
| frontend | `node_modules/concat-map` | 0.0.1 | MIT |
| frontend | `node_modules/crelt` | 1.0.7 | MIT |
| frontend | `node_modules/cross-spawn` | 7.0.6 | MIT |
| frontend | `node_modules/cssesc` | 3.0.0 | MIT |
| frontend | `node_modules/csstype` | 3.2.3 | MIT |
| frontend | `node_modules/d3-color` | 3.1.1 | ISC |
| frontend | `node_modules/d3-dispatch` | 3.0.2 | ISC |
| frontend | `node_modules/d3-drag` | 3.0.1 | ISC |
| frontend | `node_modules/d3-ease` | 3.0.2 | BSD-3-Clause |
| frontend | `node_modules/d3-interpolate` | 3.0.2 | ISC |
| frontend | `node_modules/d3-selection` | 3.0.1 | ISC |
| frontend | `node_modules/d3-timer` | 3.0.2 | ISC |
| frontend | `node_modules/d3-transition` | 3.0.2 | ISC |
| frontend | `node_modules/d3-zoom` | 3.0.1 | ISC |
| frontend | `node_modules/damerau-levenshtein` | 1.0.8 | BSD-2-Clause |
| frontend | `node_modules/data-view-buffer` | 1.0.2 | MIT |
| frontend | `node_modules/data-view-byte-length` | 1.0.2 | MIT |
| frontend | `node_modules/data-view-byte-offset` | 1.0.1 | MIT |
| frontend | `node_modules/debug` | 4.4.3 | MIT |
| frontend | `node_modules/decode-named-character-reference` | 1.3.0 | MIT |
| frontend | `node_modules/decompress-response` | 6.0.0 | MIT |
| frontend | `node_modules/deep-extend` | 0.6.0 | MIT |
| frontend | `node_modules/deep-is` | 0.1.4 | MIT |
| frontend | `node_modules/define-data-property` | 1.1.4 | MIT |
| frontend | `node_modules/define-properties` | 1.2.1 | MIT |
| frontend | `node_modules/dequal` | 2.0.3 | MIT |
| frontend | `node_modules/detect-libc` | 2.1.2 | Apache-2.0 |
| frontend | `node_modules/devlop` | 1.1.0 | MIT |
| frontend | `node_modules/didyoumean` | 1.2.2 | Apache-2.0 |
| frontend | `node_modules/dlv` | 1.1.3 | MIT |
| frontend | `node_modules/doctrine` | 3.0.0 | Apache-2.0 |
| frontend | `node_modules/dunder-proto` | 1.0.1 | MIT |
| frontend | `node_modules/eastasianwidth` | 0.2.0 | MIT |
| frontend | `node_modules/electron-to-chromium` | 1.5.456 | ISC |
| frontend | `node_modules/emoji-regex` | 9.2.2 | MIT |
| frontend | `node_modules/end-of-stream` | 1.4.5 | MIT |
| frontend | `node_modules/entities` | 4.5.0 | BSD-2-Clause |
| frontend | `node_modules/es-abstract` | 1.24.2 | MIT |
| frontend | `node_modules/es-abstract-get` | 1.0.0 | MIT |
| frontend | `node_modules/es-define-property` | 1.0.1 | MIT |
| frontend | `node_modules/es-errors` | 1.3.0 | MIT |
| frontend | `node_modules/es-iterator-helpers` | 1.4.0 | MIT |
| frontend | `node_modules/es-object-atoms` | 1.1.2 | MIT |
| frontend | `node_modules/es-set-tostringtag` | 2.1.0 | MIT |
| frontend | `node_modules/es-shim-unscopables` | 1.1.0 | MIT |
| frontend | `node_modules/es-to-primitive` | 1.3.4 | MIT |
| frontend | `node_modules/es-toolkit` | 1.52.0 | MIT |
| frontend | `node_modules/escalade` | 3.2.0 | MIT |
| frontend | `node_modules/escape-string-regexp` | 4.0.0 | MIT |
| frontend | `node_modules/eslint` | 8.57.1 | MIT |
| frontend | `node_modules/eslint-config-next` | 14.2.35 | MIT |
| frontend | `node_modules/eslint-import-resolver-node` | 0.3.10 | MIT |
| frontend | `node_modules/eslint-import-resolver-node/node_modules/debug` | 3.2.7 | MIT |
| frontend | `node_modules/eslint-import-resolver-typescript` | 3.10.1 | ISC |
| frontend | `node_modules/eslint-module-utils` | 2.14.0 | MIT |
| frontend | `node_modules/eslint-module-utils/node_modules/debug` | 3.2.7 | MIT |
| frontend | `node_modules/eslint-plugin-import` | 2.32.0 | MIT |
| frontend | `node_modules/eslint-plugin-import/node_modules/debug` | 3.2.7 | MIT |
| frontend | `node_modules/eslint-plugin-import/node_modules/doctrine` | 2.1.0 | Apache-2.0 |
| frontend | `node_modules/eslint-plugin-import/node_modules/semver` | 6.3.1 | ISC |
| frontend | `node_modules/eslint-plugin-jsx-a11y` | 6.10.2 | MIT |
| frontend | `node_modules/eslint-plugin-react` | 7.37.5 | MIT |
| frontend | `node_modules/eslint-plugin-react-hooks` | 5.0.0-canary-7118f5dd7-20230705 | MIT |
| frontend | `node_modules/eslint-plugin-react/node_modules/doctrine` | 2.1.0 | Apache-2.0 |
| frontend | `node_modules/eslint-plugin-react/node_modules/semver` | 6.3.1 | ISC |
| frontend | `node_modules/eslint-scope` | 7.2.2 | BSD-2-Clause |
| frontend | `node_modules/eslint-visitor-keys` | 3.4.3 | Apache-2.0 |
| frontend | `node_modules/espree` | 9.6.1 | BSD-2-Clause |
| frontend | `node_modules/esquery` | 1.7.0 | BSD-3-Clause |
| frontend | `node_modules/esrecurse` | 4.3.0 | BSD-2-Clause |
| frontend | `node_modules/estraverse` | 5.3.0 | BSD-2-Clause |
| frontend | `node_modules/esutils` | 2.0.3 | BSD-2-Clause |
| frontend | `node_modules/expand-template` | 2.0.3 | (MIT OR WTFPL) |
| frontend | `node_modules/extend` | 3.0.2 | MIT |
| frontend | `node_modules/fast-deep-equal` | 3.1.3 | MIT |
| frontend | `node_modules/fast-glob` | 3.3.3 | MIT |
| frontend | `node_modules/fast-glob/node_modules/glob-parent` | 5.1.2 | ISC |
| frontend | `node_modules/fast-json-stable-stringify` | 2.1.0 | MIT |
| frontend | `node_modules/fast-levenshtein` | 2.0.6 | MIT |
| frontend | `node_modules/fastq` | 1.20.3 | ISC |
| frontend | `node_modules/file-entry-cache` | 6.0.1 | MIT |
| frontend | `node_modules/fill-range` | 7.1.1 | MIT |
| frontend | `node_modules/find-up` | 5.0.0 | MIT |
| frontend | `node_modules/flat-cache` | 3.2.0 | MIT |
| frontend | `node_modules/flatted` | 3.4.4 | ISC |
| frontend | `node_modules/for-each` | 0.3.5 | MIT |
| frontend | `node_modules/foreground-child` | 3.3.1 | ISC |
| frontend | `node_modules/fraction.js` | 5.3.4 | MIT |
| frontend | `node_modules/framer-motion` | 11.18.2 | MIT |
| frontend | `node_modules/fs-constants` | 1.0.0 | MIT |
| frontend | `node_modules/fs.realpath` | 1.0.0 | ISC |
| frontend | `node_modules/fsevents` | 2.3.3 | MIT |
| frontend | `node_modules/function-bind` | 1.1.2 | MIT |
| frontend | `node_modules/function.prototype.name` | 1.2.0 | MIT |
| frontend | `node_modules/functions-have-names` | 1.2.3 | MIT |
| frontend | `node_modules/fuzzysort` | 3.1.0 | MIT |
| frontend | `node_modules/generator-function` | 2.0.1 | MIT |
| frontend | `node_modules/get-intrinsic` | 1.3.0 | MIT |
| frontend | `node_modules/get-proto` | 1.0.1 | MIT |
| frontend | `node_modules/get-symbol-description` | 1.1.0 | MIT |
| frontend | `node_modules/get-tsconfig` | 4.14.3 | MIT |
| frontend | `node_modules/github-from-package` | 0.0.0 | MIT |
| frontend | `node_modules/glob` | 10.3.10 | ISC |
| frontend | `node_modules/glob-parent` | 6.0.2 | ISC |
| frontend | `node_modules/glob/node_modules/brace-expansion` | 2.1.7 | MIT |
| frontend | `node_modules/glob/node_modules/minimatch` | 9.0.9 | ISC |
| frontend | `node_modules/globals` | 13.24.0 | MIT |
| frontend | `node_modules/globalthis` | 1.0.4 | MIT |
| frontend | `node_modules/gopd` | 1.2.0 | MIT |
| frontend | `node_modules/graceful-fs` | 4.2.11 | ISC |
| frontend | `node_modules/graphemer` | 1.4.0 | MIT |
| frontend | `node_modules/has-bigints` | 1.1.0 | MIT |
| frontend | `node_modules/has-flag` | 4.0.0 | MIT |
| frontend | `node_modules/has-property-descriptors` | 1.0.2 | MIT |
| frontend | `node_modules/has-proto` | 1.2.0 | MIT |
| frontend | `node_modules/has-symbols` | 1.1.0 | MIT |
| frontend | `node_modules/has-tostringtag` | 1.0.2 | MIT |
| frontend | `node_modules/hasown` | 2.0.4 | MIT |
| frontend | `node_modules/hast-util-embedded` | 3.0.0 | MIT |
| frontend | `node_modules/hast-util-from-dom` | 5.0.1 | ISC |
| frontend | `node_modules/hast-util-has-property` | 3.0.0 | MIT |
| frontend | `node_modules/hast-util-is-body-ok-link` | 3.0.1 | MIT |
| frontend | `node_modules/hast-util-is-element` | 3.0.0 | MIT |
| frontend | `node_modules/hast-util-minify-whitespace` | 1.0.1 | MIT |
| frontend | `node_modules/hast-util-parse-selector` | 4.0.0 | MIT |
| frontend | `node_modules/hast-util-phrasing` | 3.0.1 | MIT |
| frontend | `node_modules/hast-util-to-dom` | 4.0.1 | ISC |
| frontend | `node_modules/hast-util-to-html` | 9.0.5 | MIT |
| frontend | `node_modules/hast-util-to-mdast` | 10.1.2 | MIT |
| frontend | `node_modules/hast-util-to-text` | 4.0.3 | MIT |
| frontend | `node_modules/hast-util-whitespace` | 3.0.0 | MIT |
| frontend | `node_modules/hastscript` | 9.0.1 | MIT |
| frontend | `node_modules/html-void-elements` | 3.0.0 | MIT |
| frontend | `node_modules/ieee754` | 1.2.1 | BSD-3-Clause |
| frontend | `node_modules/ignore` | 5.3.2 | MIT |
| frontend | `node_modules/immediate` | 3.0.6 | MIT |
| frontend | `node_modules/import-fresh` | 3.3.1 | MIT |
| frontend | `node_modules/imurmurhash` | 0.1.4 | MIT |
| frontend | `node_modules/inflight` | 1.0.6 | ISC |
| frontend | `node_modules/inherits` | 2.0.4 | ISC |
| frontend | `node_modules/ini` | 1.3.8 | ISC |
| frontend | `node_modules/internal-slot` | 1.1.0 | MIT |
| frontend | `node_modules/is-array-buffer` | 3.0.5 | MIT |
| frontend | `node_modules/is-async-function` | 2.1.1 | MIT |
| frontend | `node_modules/is-bigint` | 1.1.0 | MIT |
| frontend | `node_modules/is-binary-path` | 2.1.0 | MIT |
| frontend | `node_modules/is-boolean-object` | 1.2.2 | MIT |
| frontend | `node_modules/is-bun-module` | 2.0.0 | MIT |
| frontend | `node_modules/is-callable` | 1.2.7 | MIT |
| frontend | `node_modules/is-core-module` | 2.17.0 | MIT |
| frontend | `node_modules/is-data-view` | 1.0.2 | MIT |
| frontend | `node_modules/is-date-object` | 1.1.0 | MIT |
| frontend | `node_modules/is-document.all` | 1.0.0 | MIT |
| frontend | `node_modules/is-extglob` | 2.1.1 | MIT |
| frontend | `node_modules/is-finalizationregistry` | 1.1.1 | MIT |
| frontend | `node_modules/is-fullwidth-code-point` | 3.0.0 | MIT |
| frontend | `node_modules/is-generator-function` | 1.1.2 | MIT |
| frontend | `node_modules/is-glob` | 4.0.3 | MIT |
| frontend | `node_modules/is-map` | 2.0.3 | MIT |
| frontend | `node_modules/is-negative-zero` | 2.0.3 | MIT |
| frontend | `node_modules/is-number` | 7.0.0 | MIT |
| frontend | `node_modules/is-number-object` | 1.1.1 | MIT |
| frontend | `node_modules/is-path-inside` | 3.0.3 | MIT |
| frontend | `node_modules/is-plain-obj` | 4.1.0 | MIT |
| frontend | `node_modules/is-regex` | 1.2.1 | MIT |
| frontend | `node_modules/is-set` | 2.0.3 | MIT |
| frontend | `node_modules/is-shared-array-buffer` | 1.0.4 | MIT |
| frontend | `node_modules/is-string` | 1.1.1 | MIT |
| frontend | `node_modules/is-symbol` | 1.1.1 | MIT |
| frontend | `node_modules/is-typed-array` | 1.1.15 | MIT |
| frontend | `node_modules/is-weakmap` | 2.0.2 | MIT |
| frontend | `node_modules/is-weakref` | 1.1.1 | MIT |
| frontend | `node_modules/is-weakset` | 2.0.4 | MIT |
| frontend | `node_modules/isarray` | 2.0.5 | MIT |
| frontend | `node_modules/isexe` | 2.0.0 | ISC |
| frontend | `node_modules/iterator.prototype` | 1.1.5 | MIT |
| frontend | `node_modules/jackspeak` | 2.3.6 | BlueOak-1.0.0 |
| frontend | `node_modules/jiti` | 1.21.7 | MIT |
| frontend | `node_modules/js-tokens` | 4.0.0 | MIT |
| frontend | `node_modules/js-yaml` | 4.3.2 | MIT |
| frontend | `node_modules/json-buffer` | 3.0.1 | MIT |
| frontend | `node_modules/json-schema-traverse` | 0.4.1 | MIT |
| frontend | `node_modules/json-stable-stringify-without-jsonify` | 1.0.1 | MIT |
| frontend | `node_modules/json5` | 1.0.2 | MIT |
| frontend | `node_modules/jsx-ast-utils` | 3.3.5 | MIT |
| frontend | `node_modules/keyv` | 4.5.4 | MIT |
| frontend | `node_modules/language-subtag-registry` | 0.3.23 | CC0-1.0 |
| frontend | `node_modules/language-tags` | 1.0.9 | MIT |
| frontend | `node_modules/levn` | 0.4.1 | MIT |
| frontend | `node_modules/lie` | 3.1.1 | MIT |
| frontend | `node_modules/lilconfig` | 3.1.3 | MIT |
| frontend | `node_modules/lines-and-columns` | 1.2.4 | MIT |
| frontend | `node_modules/linkify-it` | 5.0.2 | MIT |
| frontend | `node_modules/linkifyjs` | 4.4.0 | MIT |
| frontend | `node_modules/localforage` | 1.10.0 | Apache-2.0 |
| frontend | `node_modules/locate-path` | 6.0.0 | MIT |
| frontend | `node_modules/lodash.merge` | 4.6.2 | MIT |
| frontend | `node_modules/longest-streak` | 3.1.0 | MIT |
| frontend | `node_modules/loose-envify` | 1.4.0 | MIT |
| frontend | `node_modules/lru-cache` | 10.4.3 | ISC |
| frontend | `node_modules/lucide-react` | 0.454.0 | ISC |
| frontend | `node_modules/make-cancellable-promise` | 1.3.2 | MIT |
| frontend | `node_modules/make-event-props` | 1.6.2 | MIT |
| frontend | `node_modules/markdown-it` | 14.3.3 | MIT |
| frontend | `node_modules/markdown-table` | 3.1.0 | MIT |
| frontend | `node_modules/math-intrinsics` | 1.1.0 | MIT |
| frontend | `node_modules/mdast-util-find-and-replace` | 3.0.4 | MIT |
| frontend | `node_modules/mdast-util-find-and-replace/node_modules/escape-string-regexp` | 5.0.0 | MIT |
| frontend | `node_modules/mdast-util-from-markdown` | 2.1.0 | MIT |
| frontend | `node_modules/mdast-util-gfm` | 3.1.0 | MIT |
| frontend | `node_modules/mdast-util-gfm-autolink-literal` | 2.1.0 | MIT |
| frontend | `node_modules/mdast-util-gfm-footnote` | 2.1.0 | MIT |
| frontend | `node_modules/mdast-util-gfm-strikethrough` | 2.0.1 | MIT |
| frontend | `node_modules/mdast-util-gfm-table` | 2.0.1 | MIT |
| frontend | `node_modules/mdast-util-gfm-task-list-item` | 2.0.1 | MIT |
| frontend | `node_modules/mdast-util-newline-to-break` | 2.0.0 | MIT |
| frontend | `node_modules/mdast-util-phrasing` | 4.1.0 | MIT |
| frontend | `node_modules/mdast-util-to-hast` | 13.2.1 | MIT |
| frontend | `node_modules/mdast-util-to-markdown` | 2.2.3 | MIT |
| frontend | `node_modules/mdast-util-to-string` | 4.0.0 | MIT |
| frontend | `node_modules/mdurl` | 2.1.0 | MIT |
| frontend | `node_modules/merge-refs` | 1.3.0 | MIT |
| frontend | `node_modules/merge2` | 1.4.1 | MIT |
| frontend | `node_modules/micromark` | 4.0.3 | MIT |
| frontend | `node_modules/micromark-core-commonmark` | 2.0.4 | MIT |
| frontend | `node_modules/micromark-extension-gfm` | 3.0.0 | MIT |
| frontend | `node_modules/micromark-extension-gfm-autolink-literal` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-extension-gfm-footnote` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-extension-gfm-strikethrough` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-extension-gfm-table` | 2.1.2 | MIT |
| frontend | `node_modules/micromark-extension-gfm-tagfilter` | 2.0.0 | MIT |
| frontend | `node_modules/micromark-extension-gfm-task-list-item` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-factory-destination` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-factory-label` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-factory-space` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-factory-title` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-factory-whitespace` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-character` | 2.1.1 | MIT |
| frontend | `node_modules/micromark-util-chunked` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-classify-character` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-combine-extensions` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-decode-numeric-character-reference` | 2.0.2 | MIT |
| frontend | `node_modules/micromark-util-decode-string` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-edit-map` | 1.0.0 | MIT |
| frontend | `node_modules/micromark-util-encode` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-html-tag-name` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-normalize-identifier` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-resolve-all` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-sanitize-uri` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-subtokenize` | 2.1.0 | MIT |
| frontend | `node_modules/micromark-util-symbol` | 2.0.1 | MIT |
| frontend | `node_modules/micromark-util-types` | 2.0.3 | MIT |
| frontend | `node_modules/micromatch` | 4.0.8 | MIT |
| frontend | `node_modules/mimic-response` | 3.1.0 | MIT |
| frontend | `node_modules/minimatch` | 3.1.5 | ISC |
| frontend | `node_modules/minimist` | 1.2.8 | MIT |
| frontend | `node_modules/minipass` | 7.1.3 | BlueOak-1.0.0 |
| frontend | `node_modules/mkdirp-classic` | 0.5.3 | MIT |
| frontend | `node_modules/motion-dom` | 11.18.1 | MIT |
| frontend | `node_modules/motion-utils` | 11.18.1 | MIT |
| frontend | `node_modules/ms` | 2.1.3 | MIT |
| frontend | `node_modules/mz` | 2.7.0 | MIT |
| frontend | `node_modules/nanoid` | 3.3.20 | MIT |
| frontend | `node_modules/napi-build-utils` | 2.0.0 | MIT |
| frontend | `node_modules/napi-postinstall` | 0.3.4 | MIT |
| frontend | `node_modules/natural-compare` | 1.4.0 | MIT |
| frontend | `node_modules/next` | 14.2.35 | MIT |
| frontend | `node_modules/next/node_modules/postcss` | 8.4.31 | MIT |
| frontend | `node_modules/node-abi` | 3.101.0 | MIT |
| frontend | `node_modules/node-addon-api` | 7.1.1 | MIT |
| frontend | `node_modules/node-exports-info` | 1.6.2 | MIT |
| frontend | `node_modules/node-exports-info/node_modules/semver` | 6.3.1 | ISC |
| frontend | `node_modules/node-releases` | 2.0.58 | MIT |
| frontend | `node_modules/normalize-path` | 3.0.0 | MIT |
| frontend | `node_modules/object-assign` | 4.1.1 | MIT |
| frontend | `node_modules/object-hash` | 3.0.0 | MIT |
| frontend | `node_modules/object-inspect` | 1.13.4 | MIT |
| frontend | `node_modules/object-keys` | 1.1.1 | MIT |
| frontend | `node_modules/object.assign` | 4.1.7 | MIT |
| frontend | `node_modules/object.entries` | 1.1.9 | MIT |
| frontend | `node_modules/object.fromentries` | 2.0.8 | MIT |
| frontend | `node_modules/object.groupby` | 1.0.3 | MIT |
| frontend | `node_modules/object.values` | 1.2.1 | MIT |
| frontend | `node_modules/once` | 1.4.0 | ISC |
| frontend | `node_modules/optionator` | 0.9.4 | MIT |
| frontend | `node_modules/orderedmap` | 2.1.1 | MIT |
| frontend | `node_modules/own-keys` | 1.0.2 | MIT |
| frontend | `node_modules/p-limit` | 3.1.0 | MIT |
| frontend | `node_modules/p-locate` | 5.0.0 | MIT |
| frontend | `node_modules/parent-module` | 1.0.1 | MIT |
| frontend | `node_modules/path-exists` | 4.0.0 | MIT |
| frontend | `node_modules/path-is-absolute` | 1.0.1 | MIT |
| frontend | `node_modules/path-key` | 3.1.1 | MIT |
| frontend | `node_modules/path-parse` | 1.0.7 | MIT |
| frontend | `node_modules/path-scurry` | 1.11.1 | BlueOak-1.0.0 |
| frontend | `node_modules/path2d` | 0.2.2 | MIT |
| frontend | `node_modules/pdfjs-dist` | 4.8.69 | Apache-2.0 |
| frontend | `node_modules/picocolors` | 1.1.1 | ISC |
| frontend | `node_modules/picomatch` | 2.3.2 | MIT |
| frontend | `node_modules/pirates` | 4.0.7 | MIT |
| frontend | `node_modules/playwright-core` | 1.58.2 | Apache-2.0 |
| frontend | `node_modules/possible-typed-array-names` | 1.1.0 | MIT |
| frontend | `node_modules/postcss` | 8.5.30 | MIT |
| frontend | `node_modules/postcss-import` | 15.1.0 | MIT |
| frontend | `node_modules/postcss-import/node_modules/resolve` | 1.22.13 | MIT |
| frontend | `node_modules/postcss-js` | 4.1.0 | MIT |
| frontend | `node_modules/postcss-load-config` | 6.0.1 | MIT |
| frontend | `node_modules/postcss-nested` | 6.2.0 | MIT |
| frontend | `node_modules/postcss-selector-parser` | 6.1.4 | MIT |
| frontend | `node_modules/postcss-value-parser` | 4.2.0 | MIT |
| frontend | `node_modules/prebuild-install` | 7.1.3 | MIT |
| frontend | `node_modules/prelude-ls` | 1.2.1 | MIT |
| frontend | `node_modules/prop-types` | 15.8.1 | MIT |
| frontend | `node_modules/property-information` | 7.2.0 | MIT |
| frontend | `node_modules/prosemirror-changeset` | 2.4.6 | MIT |
| frontend | `node_modules/prosemirror-collab` | 1.3.1 | MIT |
| frontend | `node_modules/prosemirror-commands` | 1.7.2 | MIT |
| frontend | `node_modules/prosemirror-dropcursor` | 1.8.4 | MIT |
| frontend | `node_modules/prosemirror-gapcursor` | 1.4.1 | MIT |
| frontend | `node_modules/prosemirror-history` | 1.5.1 | MIT |
| frontend | `node_modules/prosemirror-inputrules` | 1.5.1 | MIT |
| frontend | `node_modules/prosemirror-keymap` | 1.2.3 | MIT |
| frontend | `node_modules/prosemirror-markdown` | 1.13.9 | MIT |
| frontend | `node_modules/prosemirror-menu` | 1.3.2 | MIT |
| frontend | `node_modules/prosemirror-model` | 1.25.12 | MIT |
| frontend | `node_modules/prosemirror-schema-basic` | 1.2.5 | MIT |
| frontend | `node_modules/prosemirror-schema-list` | 1.6.0 | MIT |
| frontend | `node_modules/prosemirror-state` | 1.4.4 | MIT |
| frontend | `node_modules/prosemirror-tables` | 1.8.5 | MIT |
| frontend | `node_modules/prosemirror-trailing-node` | 3.0.0 | MIT |
| frontend | `node_modules/prosemirror-transform` | 1.12.5 | MIT |
| frontend | `node_modules/prosemirror-view` | 1.42.9 | MIT |
| frontend | `node_modules/pump` | 3.0.4 | MIT |
| frontend | `node_modules/punycode` | 2.3.1 | MIT |
| frontend | `node_modules/punycode.js` | 2.3.1 | MIT |
| frontend | `node_modules/queue-microtask` | 1.2.3 | MIT |
| frontend | `node_modules/rc` | 1.2.8 | (BSD-2-Clause OR MIT OR Apache-2.0) |
| frontend | `node_modules/rc/node_modules/strip-json-comments` | 2.0.1 | MIT |
| frontend | `node_modules/react` | 18.3.1 | MIT |
| frontend | `node_modules/react-dom` | 18.3.1 | MIT |
| frontend | `node_modules/react-is` | 16.13.1 | MIT |
| frontend | `node_modules/react-pdf` | 9.2.1 | MIT |
| frontend | `node_modules/read-cache` | 1.0.2 | MIT |
| frontend | `node_modules/readable-stream` | 3.6.2 | MIT |
| frontend | `node_modules/readdirp` | 3.6.0 | MIT |
| frontend | `node_modules/reflect.getprototypeof` | 1.0.10 | MIT |
| frontend | `node_modules/regexp.prototype.flags` | 1.5.4 | MIT |
| frontend | `node_modules/rehype-dom-stringify` | 4.0.2 | ISC |
| frontend | `node_modules/rehype-minify-whitespace` | 6.0.2 | MIT |
| frontend | `node_modules/rehype-remark` | 10.0.1 | MIT |
| frontend | `node_modules/remark-breaks` | 4.0.0 | MIT |
| frontend | `node_modules/remark-gfm` | 4.0.1 | MIT |
| frontend | `node_modules/remark-parse` | 11.0.0 | MIT |
| frontend | `node_modules/remark-rehype` | 11.1.2 | MIT |
| frontend | `node_modules/remark-stringify` | 11.0.0 | MIT |
| frontend | `node_modules/resolve` | 2.0.0-next.7 | MIT |
| frontend | `node_modules/resolve-from` | 4.0.0 | MIT |
| frontend | `node_modules/resolve-pkg-maps` | 1.0.0 | MIT |
| frontend | `node_modules/reusify` | 1.1.0 | MIT |
| frontend | `node_modules/rimraf` | 3.0.2 | ISC |
| frontend | `node_modules/rimraf/node_modules/glob` | 7.2.3 | ISC |
| frontend | `node_modules/rope-sequence` | 1.3.4 | MIT |
| frontend | `node_modules/run-parallel` | 1.2.0 | MIT |
| frontend | `node_modules/safe-array-concat` | 1.1.4 | MIT |
| frontend | `node_modules/safe-buffer` | 5.2.1 | MIT |
| frontend | `node_modules/safe-push-apply` | 1.0.0 | MIT |
| frontend | `node_modules/safe-regex-test` | 1.1.0 | MIT |
| frontend | `node_modules/scheduler` | 0.23.2 | MIT |
| frontend | `node_modules/semver` | 7.8.5 | ISC |
| frontend | `node_modules/set-function-length` | 1.2.2 | MIT |
| frontend | `node_modules/set-function-name` | 2.0.2 | MIT |
| frontend | `node_modules/set-proto` | 1.0.0 | MIT |
| frontend | `node_modules/shebang-command` | 2.0.0 | MIT |
| frontend | `node_modules/shebang-regex` | 3.0.0 | MIT |
| frontend | `node_modules/side-channel` | 1.1.1 | MIT |
| frontend | `node_modules/side-channel-list` | 1.0.1 | MIT |
| frontend | `node_modules/side-channel-map` | 1.0.1 | MIT |
| frontend | `node_modules/side-channel-weakmap` | 1.0.2 | MIT |
| frontend | `node_modules/signal-exit` | 4.1.0 | ISC |
| frontend | `node_modules/simple-concat` | 1.0.1 | MIT |
| frontend | `node_modules/simple-get` | 4.0.1 | MIT |
| frontend | `node_modules/source-map-js` | 1.2.2 | BSD-3-Clause |
| frontend | `node_modules/space-separated-tokens` | 2.0.2 | MIT |
| frontend | `node_modules/stable-hash` | 0.0.5 | MIT |
| frontend | `node_modules/stop-iteration-iterator` | 1.1.0 | MIT |
| frontend | `node_modules/streamsearch` | 1.1.0 | No declarada |
| frontend | `node_modules/string-width` | 5.1.2 | MIT |
| frontend | `node_modules/string-width-cjs` | 4.2.3 | MIT |
| frontend | `node_modules/string-width-cjs/node_modules/emoji-regex` | 8.0.0 | MIT |
| frontend | `node_modules/string-width/node_modules/ansi-regex` | 6.4.0 | MIT |
| frontend | `node_modules/string-width/node_modules/strip-ansi` | 7.2.0 | MIT |
| frontend | `node_modules/string.prototype.includes` | 2.0.1 | MIT |
| frontend | `node_modules/string.prototype.matchall` | 4.1.0 | MIT |
| frontend | `node_modules/string.prototype.repeat` | 1.0.0 | MIT |
| frontend | `node_modules/string.prototype.trim` | 1.2.11 | MIT |
| frontend | `node_modules/string.prototype.trimend` | 1.0.10 | MIT |
| frontend | `node_modules/string.prototype.trimstart` | 1.0.8 | MIT |
| frontend | `node_modules/string_decoder` | 1.3.0 | MIT |
| frontend | `node_modules/stringify-entities` | 4.0.4 | MIT |
| frontend | `node_modules/strip-ansi` | 6.0.1 | MIT |
| frontend | `node_modules/strip-ansi-cjs` | 6.0.1 | MIT |
| frontend | `node_modules/strip-bom` | 3.0.0 | MIT |
| frontend | `node_modules/strip-json-comments` | 3.1.1 | MIT |
| frontend | `node_modules/styled-jsx` | 5.1.1 | MIT |
| frontend | `node_modules/sucrase` | 3.35.1 | MIT |
| frontend | `node_modules/supports-color` | 7.2.0 | MIT |
| frontend | `node_modules/supports-preserve-symlinks-flag` | 1.0.0 | MIT |
| frontend | `node_modules/tailwind-merge` | 2.6.1 | MIT |
| frontend | `node_modules/tailwindcss` | 3.4.19 | MIT |
| frontend | `node_modules/tailwindcss-animate` | 1.0.7 | MIT |
| frontend | `node_modules/tailwindcss/node_modules/resolve` | 1.22.13 | MIT |
| frontend | `node_modules/tar-fs` | 2.1.5 | MIT |
| frontend | `node_modules/tar-stream` | 2.2.0 | MIT |
| frontend | `node_modules/text-table` | 0.2.0 | MIT |
| frontend | `node_modules/thenify` | 3.3.1 | MIT |
| frontend | `node_modules/thenify-all` | 1.6.0 | MIT |
| frontend | `node_modules/tiny-invariant` | 1.3.3 | MIT |
| frontend | `node_modules/tinyglobby` | 0.2.17 | MIT |
| frontend | `node_modules/tinyglobby/node_modules/fdir` | 6.5.0 | MIT |
| frontend | `node_modules/tinyglobby/node_modules/picomatch` | 4.0.7 | MIT |
| frontend | `node_modules/tippy.js` | 6.3.7 | MIT |
| frontend | `node_modules/to-regex-range` | 5.0.1 | MIT |
| frontend | `node_modules/trim-lines` | 3.0.1 | MIT |
| frontend | `node_modules/trim-trailing-lines` | 2.1.0 | MIT |
| frontend | `node_modules/trough` | 2.2.0 | MIT |
| frontend | `node_modules/ts-api-utils` | 2.5.0 | MIT |
| frontend | `node_modules/ts-interface-checker` | 0.1.13 | Apache-2.0 |
| frontend | `node_modules/tsconfig-paths` | 3.15.0 | MIT |
| frontend | `node_modules/tslib` | 2.8.1 | 0BSD |
| frontend | `node_modules/tunnel-agent` | 0.6.0 | Apache-2.0 |
| frontend | `node_modules/type-check` | 0.4.0 | MIT |
| frontend | `node_modules/type-fest` | 0.20.2 | (MIT OR CC0-1.0) |
| frontend | `node_modules/typed-array-buffer` | 1.0.3 | MIT |
| frontend | `node_modules/typed-array-byte-length` | 1.0.3 | MIT |
| frontend | `node_modules/typed-array-byte-offset` | 1.0.5 | MIT |
| frontend | `node_modules/typed-array-length` | 1.0.8 | MIT |
| frontend | `node_modules/typescript` | 5.9.3 | Apache-2.0 |
| frontend | `node_modules/uc.micro` | 2.1.0 | MIT |
| frontend | `node_modules/unbox-primitive` | 1.1.0 | MIT |
| frontend | `node_modules/undici-types` | 6.21.0 | MIT |
| frontend | `node_modules/unified` | 11.0.5 | MIT |
| frontend | `node_modules/unist-util-is` | 6.0.1 | MIT |
| frontend | `node_modules/unist-util-position` | 5.0.0 | MIT |
| frontend | `node_modules/unist-util-stringify-position` | 4.0.0 | MIT |
| frontend | `node_modules/unist-util-visit` | 5.0.0 | MIT |
| frontend | `node_modules/unist-util-visit-parents` | 6.1.0 | MIT |
| frontend | `node_modules/unrs-resolver` | 1.12.2 | MIT |
| frontend | `node_modules/update-browserslist-db` | 1.3.4 | MIT |
| frontend | `node_modules/uri-js` | 4.4.1 | BSD-2-Clause |
| frontend | `node_modules/use-sync-external-store` | 1.7.0 | MIT |
| frontend | `node_modules/util-deprecate` | 1.0.2 | MIT |
| frontend | `node_modules/vanilla-colorful` | 0.7.2 | MIT |
| frontend | `node_modules/vfile` | 6.0.3 | MIT |
| frontend | `node_modules/vfile-message` | 4.0.4 | MIT |
| frontend | `node_modules/w3c-keyname` | 2.2.8 | MIT |
| frontend | `node_modules/warning` | 4.0.3 | MIT |
| frontend | `node_modules/web-namespaces` | 2.0.1 | MIT |
| frontend | `node_modules/which` | 2.0.2 | ISC |
| frontend | `node_modules/which-boxed-primitive` | 1.1.1 | MIT |
| frontend | `node_modules/which-builtin-type` | 1.2.1 | MIT |
| frontend | `node_modules/which-collection` | 1.0.2 | MIT |
| frontend | `node_modules/which-typed-array` | 1.1.24 | MIT |
| frontend | `node_modules/word-wrap` | 1.2.5 | MIT |
| frontend | `node_modules/wrap-ansi` | 8.1.0 | MIT |
| frontend | `node_modules/wrap-ansi-cjs` | 7.0.0 | MIT |
| frontend | `node_modules/wrap-ansi-cjs/node_modules/emoji-regex` | 8.0.0 | MIT |
| frontend | `node_modules/wrap-ansi-cjs/node_modules/string-width` | 4.2.3 | MIT |
| frontend | `node_modules/wrap-ansi/node_modules/ansi-regex` | 6.4.0 | MIT |
| frontend | `node_modules/wrap-ansi/node_modules/ansi-styles` | 6.2.3 | MIT |
| frontend | `node_modules/wrap-ansi/node_modules/strip-ansi` | 7.2.0 | MIT |
| frontend | `node_modules/wrappy` | 1.0.2 | ISC |
| frontend | `node_modules/yocto-queue` | 0.1.0 | MIT |
| frontend | `node_modules/zustand` | 4.5.7 | MIT |
| frontend | `node_modules/zwitch` | 2.0.4 | MIT |
| desktop | `node_modules/@electron-internal/extract-zip` | 1.0.5 | BSD-2-Clause |
| desktop | `node_modules/@electron/asar` | 3.4.1 | MIT |
| desktop | `node_modules/@electron/asar/node_modules/balanced-match` | 1.0.2 | MIT |
| desktop | `node_modules/@electron/asar/node_modules/brace-expansion` | 1.1.21 | MIT |
| desktop | `node_modules/@electron/asar/node_modules/minimatch` | 3.1.5 | ISC |
| desktop | `node_modules/@electron/fuses` | 1.8.0 | MIT |
| desktop | `node_modules/@electron/fuses/node_modules/fs-extra` | 9.1.0 | MIT |
| desktop | `node_modules/@electron/get` | 5.1.0 | MIT |
| desktop | `node_modules/@electron/notarize` | 2.5.0 | MIT |
| desktop | `node_modules/@electron/notarize/node_modules/fs-extra` | 9.1.0 | MIT |
| desktop | `node_modules/@electron/osx-sign` | 1.3.3 | BSD-2-Clause |
| desktop | `node_modules/@electron/osx-sign/node_modules/isbinaryfile` | 4.0.10 | MIT |
| desktop | `node_modules/@electron/rebuild` | 4.2.1 | MIT |
| desktop | `node_modules/@electron/universal` | 2.0.3 | MIT |
| desktop | `node_modules/@electron/universal/node_modules/balanced-match` | 1.0.2 | MIT |
| desktop | `node_modules/@electron/universal/node_modules/brace-expansion` | 2.1.7 | MIT |
| desktop | `node_modules/@electron/universal/node_modules/fs-extra` | 11.4.1 | MIT |
| desktop | `node_modules/@electron/universal/node_modules/minimatch` | 9.0.9 | ISC |
| desktop | `node_modules/@electron/windows-sign` | 1.2.2 | BSD-2-Clause |
| desktop | `node_modules/@electron/windows-sign/node_modules/fs-extra` | 11.4.1 | MIT |
| desktop | `node_modules/@isaacs/fs-minipass` | 4.0.1 | ISC |
| desktop | `node_modules/@malept/cross-spawn-promise` | 2.0.0 | Apache-2.0 |
| desktop | `node_modules/@malept/flatpak-bundler` | 0.4.0 | MIT |
| desktop | `node_modules/@malept/flatpak-bundler/node_modules/fs-extra` | 9.1.0 | MIT |
| desktop | `node_modules/@noble/hashes` | 2.4.0 | MIT |
| desktop | `node_modules/@peculiar/asn1-schema` | 2.11.0 | MIT |
| desktop | `node_modules/@peculiar/json-schema` | 1.1.12 | MIT |
| desktop | `node_modules/@peculiar/utils` | 2.0.3 | MIT |
| desktop | `node_modules/@peculiar/webcrypto` | 1.7.1 | MIT |
| desktop | `node_modules/@sindresorhus/is` | 4.6.0 | MIT |
| desktop | `node_modules/@szmarczak/http-timer` | 4.0.6 | MIT |
| desktop | `node_modules/@types/cacheable-request` | 6.0.3 | MIT |
| desktop | `node_modules/@types/debug` | 4.1.13 | MIT |
| desktop | `node_modules/@types/fs-extra` | 9.0.13 | MIT |
| desktop | `node_modules/@types/http-cache-semantics` | 4.2.0 | MIT |
| desktop | `node_modules/@types/keyv` | 3.1.4 | MIT |
| desktop | `node_modules/@types/ms` | 2.1.0 | MIT |
| desktop | `node_modules/@types/node` | 24.19.2 | MIT |
| desktop | `node_modules/@types/responselike` | 1.0.3 | MIT |
| desktop | `node_modules/@xmldom/xmldom` | 0.8.15 | MIT |
| desktop | `node_modules/abbrev` | 4.0.0 | ISC |
| desktop | `node_modules/agent-base` | 7.1.4 | MIT |
| desktop | `node_modules/ajv` | 8.20.0 | MIT |
| desktop | `node_modules/ansi-regex` | 5.0.1 | MIT |
| desktop | `node_modules/ansi-styles` | 4.3.0 | MIT |
| desktop | `node_modules/app-builder-lib` | 26.15.3 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/@electron/get` | 3.1.0 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/@electron/get/node_modules/fs-extra` | 8.1.0 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/@electron/get/node_modules/semver` | 6.3.1 | ISC |
| desktop | `node_modules/app-builder-lib/node_modules/ci-info` | 4.3.1 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/env-paths` | 2.2.1 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/jsonfile` | 4.0.0 | MIT |
| desktop | `node_modules/app-builder-lib/node_modules/semver` | 7.7.4 | ISC |
| desktop | `node_modules/app-builder-lib/node_modules/universalify` | 0.1.2 | MIT |
| desktop | `node_modules/argparse` | 2.0.1 | Python-2.0 |
| desktop | `node_modules/asn1js` | 3.1.0 | BSD-3-Clause |
| desktop | `node_modules/async` | 3.2.6 | MIT |
| desktop | `node_modules/async-exit-hook` | 2.0.1 | MIT |
| desktop | `node_modules/asynckit` | 0.4.0 | MIT |
| desktop | `node_modules/at-least-node` | 1.0.0 | ISC |
| desktop | `node_modules/aws4` | 1.13.2 | MIT |
| desktop | `node_modules/balanced-match` | 4.0.4 | MIT |
| desktop | `node_modules/base64-js` | 1.5.1 | MIT |
| desktop | `node_modules/bluebird` | 3.7.2 | MIT |
| desktop | `node_modules/boolean` | 3.2.0 | MIT |
| desktop | `node_modules/brace-expansion` | 5.0.12 | MIT |
| desktop | `node_modules/buffer-from` | 1.1.2 | MIT |
| desktop | `node_modules/builder-util` | 26.15.3 | MIT |
| desktop | `node_modules/builder-util-runtime` | 9.7.0 | MIT |
| desktop | `node_modules/bytestreamjs` | 2.0.1 | BSD-3-Clause |
| desktop | `node_modules/cacheable-lookup` | 5.0.4 | MIT |
| desktop | `node_modules/cacheable-request` | 7.0.4 | MIT |
| desktop | `node_modules/call-bind-apply-helpers` | 1.0.2 | MIT |
| desktop | `node_modules/chalk` | 4.1.2 | MIT |
| desktop | `node_modules/chownr` | 3.0.0 | BlueOak-1.0.0 |
| desktop | `node_modules/chromium-pickle-js` | 0.2.0 | MIT |
| desktop | `node_modules/ci-info` | 4.4.0 | MIT |
| desktop | `node_modules/cliui` | 8.0.1 | ISC |
| desktop | `node_modules/clone-response` | 1.0.3 | MIT |
| desktop | `node_modules/color-convert` | 2.0.1 | MIT |
| desktop | `node_modules/color-name` | 1.1.4 | MIT |
| desktop | `node_modules/combined-stream` | 1.0.8 | MIT |
| desktop | `node_modules/commander` | 5.1.0 | MIT |
| desktop | `node_modules/compare-version` | 0.1.2 | MIT |
| desktop | `node_modules/concat-map` | 0.0.1 | MIT |
| desktop | `node_modules/core-util-is` | 1.0.3 | MIT |
| desktop | `node_modules/cross-dirname` | 0.1.0 | MIT |
| desktop | `node_modules/cross-spawn` | 7.0.6 | MIT |
| desktop | `node_modules/cross-spawn/node_modules/isexe` | 2.0.0 | ISC |
| desktop | `node_modules/cross-spawn/node_modules/which` | 2.0.2 | ISC |
| desktop | `node_modules/debug` | 4.4.3 | MIT |
| desktop | `node_modules/decompress-response` | 6.0.0 | MIT |
| desktop | `node_modules/decompress-response/node_modules/mimic-response` | 3.1.0 | MIT |
| desktop | `node_modules/defer-to-connect` | 2.0.1 | MIT |
| desktop | `node_modules/define-data-property` | 1.1.4 | MIT |
| desktop | `node_modules/define-properties` | 1.2.1 | MIT |
| desktop | `node_modules/delayed-stream` | 1.0.0 | MIT |
| desktop | `node_modules/detect-node` | 2.1.0 | MIT |
| desktop | `node_modules/dir-compare` | 4.2.0 | MIT |
| desktop | `node_modules/dir-compare/node_modules/balanced-match` | 1.0.2 | MIT |
| desktop | `node_modules/dir-compare/node_modules/brace-expansion` | 1.1.21 | MIT |
| desktop | `node_modules/dir-compare/node_modules/minimatch` | 3.1.5 | ISC |
| desktop | `node_modules/dmg-builder` | 26.15.3 | MIT |
| desktop | `node_modules/dotenv` | 16.6.1 | BSD-2-Clause |
| desktop | `node_modules/dotenv-expand` | 11.0.7 | BSD-2-Clause |
| desktop | `node_modules/dunder-proto` | 1.0.1 | MIT |
| desktop | `node_modules/duplexer2` | 0.1.4 | BSD-3-Clause |
| desktop | `node_modules/ejs` | 3.1.10 | Apache-2.0 |
| desktop | `node_modules/electron` | 45.0.0 | MIT |
| desktop | `node_modules/electron-builder` | 26.15.3 | MIT |
| desktop | `node_modules/electron-builder-squirrel-windows` | 26.15.3 | MIT |
| desktop | `node_modules/electron-publish` | 26.15.3 | MIT |
| desktop | `node_modules/electron-updater` | 6.8.11 | MIT |
| desktop | `node_modules/electron-updater/node_modules/semver` | 7.7.4 | ISC |
| desktop | `node_modules/electron-winstaller` | 5.4.0 | MIT |
| desktop | `node_modules/electron-winstaller/node_modules/fs-extra` | 7.0.1 | MIT |
| desktop | `node_modules/electron-winstaller/node_modules/jsonfile` | 4.0.0 | MIT |
| desktop | `node_modules/electron-winstaller/node_modules/universalify` | 0.1.2 | MIT |
| desktop | `node_modules/emoji-regex` | 8.0.0 | MIT |
| desktop | `node_modules/end-of-stream` | 1.4.5 | MIT |
| desktop | `node_modules/env-paths` | 3.0.0 | MIT |
| desktop | `node_modules/err-code` | 2.0.3 | MIT |
| desktop | `node_modules/es-define-property` | 1.0.1 | MIT |
| desktop | `node_modules/es-errors` | 1.3.0 | MIT |
| desktop | `node_modules/es-object-atoms` | 1.1.2 | MIT |
| desktop | `node_modules/es-set-tostringtag` | 2.1.0 | MIT |
| desktop | `node_modules/es6-error` | 4.1.1 | MIT |
| desktop | `node_modules/escalade` | 3.2.0 | MIT |
| desktop | `node_modules/escape-string-regexp` | 4.0.0 | MIT |
| desktop | `node_modules/exponential-backoff` | 3.1.3 | Apache-2.0 |
| desktop | `node_modules/fast-deep-equal` | 3.1.3 | MIT |
| desktop | `node_modules/fast-uri` | 3.1.9 | BSD-3-Clause |
| desktop | `node_modules/fdir` | 6.5.0 | MIT |
| desktop | `node_modules/filelist` | 1.0.6 | Apache-2.0 |
| desktop | `node_modules/filelist/node_modules/balanced-match` | 1.0.2 | MIT |
| desktop | `node_modules/filelist/node_modules/brace-expansion` | 2.1.7 | MIT |
| desktop | `node_modules/filelist/node_modules/minimatch` | 5.1.9 | ISC |
| desktop | `node_modules/form-data` | 4.0.6 | MIT |
| desktop | `node_modules/fs-extra` | 10.1.0 | MIT |
| desktop | `node_modules/fs.realpath` | 1.0.0 | ISC |
| desktop | `node_modules/function-bind` | 1.1.2 | MIT |
| desktop | `node_modules/get-caller-file` | 2.0.5 | ISC |
| desktop | `node_modules/get-intrinsic` | 1.3.0 | MIT |
| desktop | `node_modules/get-proto` | 1.0.1 | MIT |
| desktop | `node_modules/get-stream` | 5.2.0 | MIT |
| desktop | `node_modules/glob` | 7.2.3 | ISC |
| desktop | `node_modules/glob/node_modules/balanced-match` | 1.0.2 | MIT |
| desktop | `node_modules/glob/node_modules/brace-expansion` | 1.1.21 | MIT |
| desktop | `node_modules/glob/node_modules/minimatch` | 3.1.5 | ISC |
| desktop | `node_modules/global-agent` | 3.0.0 | BSD-3-Clause |
| desktop | `node_modules/globalthis` | 1.0.4 | MIT |
| desktop | `node_modules/gopd` | 1.2.0 | MIT |
| desktop | `node_modules/got` | 11.8.6 | MIT |
| desktop | `node_modules/graceful-fs` | 4.2.11 | ISC |
| desktop | `node_modules/has-flag` | 4.0.0 | MIT |
| desktop | `node_modules/has-property-descriptors` | 1.0.2 | MIT |
| desktop | `node_modules/has-symbols` | 1.1.0 | MIT |
| desktop | `node_modules/has-tostringtag` | 1.0.2 | MIT |
| desktop | `node_modules/hasown` | 2.0.4 | MIT |
| desktop | `node_modules/hosted-git-info` | 4.1.0 | ISC |
| desktop | `node_modules/http-cache-semantics` | 4.3.0 | BSD-2-Clause |
| desktop | `node_modules/http-proxy-agent` | 7.0.2 | MIT |
| desktop | `node_modules/http2-wrapper` | 1.0.3 | MIT |
| desktop | `node_modules/https-proxy-agent` | 7.0.6 | MIT |
| desktop | `node_modules/inflight` | 1.0.6 | ISC |
| desktop | `node_modules/inherits` | 2.0.4 | ISC |
| desktop | `node_modules/is-fullwidth-code-point` | 3.0.0 | MIT |
| desktop | `node_modules/isarray` | 1.0.0 | MIT |
| desktop | `node_modules/isbinaryfile` | 5.0.7 | MIT |
| desktop | `node_modules/isexe` | 3.1.5 | BlueOak-1.0.0 |
| desktop | `node_modules/jake` | 10.9.4 | Apache-2.0 |
| desktop | `node_modules/jiti` | 2.7.0 | MIT |
| desktop | `node_modules/js-yaml` | 4.3.2 | MIT |
| desktop | `node_modules/json-buffer` | 3.0.1 | MIT |
| desktop | `node_modules/json-schema-traverse` | 1.0.0 | MIT |
| desktop | `node_modules/json-stringify-safe` | 5.0.1 | ISC |
| desktop | `node_modules/json5` | 2.2.3 | MIT |
| desktop | `node_modules/jsonfile` | 6.2.1 | MIT |
| desktop | `node_modules/keyv` | 4.5.4 | MIT |
| desktop | `node_modules/lazy-val` | 1.0.5 | MIT |
| desktop | `node_modules/lodash` | 4.18.1 | MIT |
| desktop | `node_modules/lodash.escaperegexp` | 4.1.2 | MIT |
| desktop | `node_modules/lodash.isequal` | 4.5.0 | MIT |
| desktop | `node_modules/lowercase-keys` | 2.0.0 | MIT |
| desktop | `node_modules/lru-cache` | 6.0.0 | ISC |
| desktop | `node_modules/matcher` | 3.0.0 | MIT |
| desktop | `node_modules/math-intrinsics` | 1.1.0 | MIT |
| desktop | `node_modules/mime` | 2.6.0 | MIT |
| desktop | `node_modules/mime-db` | 1.52.0 | MIT |
| desktop | `node_modules/mime-types` | 2.1.35 | MIT |
| desktop | `node_modules/mimic-response` | 1.0.1 | MIT |
| desktop | `node_modules/minimatch` | 10.2.6 | BlueOak-1.0.0 |
| desktop | `node_modules/minimist` | 1.2.8 | MIT |
| desktop | `node_modules/minipass` | 7.1.3 | BlueOak-1.0.0 |
| desktop | `node_modules/minizlib` | 3.1.0 | MIT |
| desktop | `node_modules/mkdirp` | 0.5.6 | MIT |
| desktop | `node_modules/ms` | 2.1.3 | MIT |
| desktop | `node_modules/node-abi` | 4.38.0 | MIT |
| desktop | `node_modules/node-api-version` | 0.2.1 | MIT |
| desktop | `node_modules/node-gyp` | 12.4.0 | MIT |
| desktop | `node_modules/node-gyp/node_modules/env-paths` | 2.2.1 | MIT |
| desktop | `node_modules/node-gyp/node_modules/isexe` | 4.0.0 | BlueOak-1.0.0 |
| desktop | `node_modules/node-gyp/node_modules/undici` | 6.29.1 | MIT |
| desktop | `node_modules/node-gyp/node_modules/which` | 6.0.1 | ISC |
| desktop | `node_modules/node-int64` | 0.4.0 | MIT |
| desktop | `node_modules/nopt` | 9.0.0 | ISC |
| desktop | `node_modules/normalize-url` | 6.1.0 | MIT |
| desktop | `node_modules/object-keys` | 1.1.1 | MIT |
| desktop | `node_modules/once` | 1.4.0 | ISC |
| desktop | `node_modules/p-cancelable` | 2.1.1 | MIT |
| desktop | `node_modules/p-limit` | 3.1.0 | MIT |
| desktop | `node_modules/path-is-absolute` | 1.0.1 | MIT |
| desktop | `node_modules/path-key` | 3.1.1 | MIT |
| desktop | `node_modules/pe-library` | 0.4.1 | MIT |
| desktop | `node_modules/picocolors` | 1.1.1 | ISC |
| desktop | `node_modules/picomatch` | 4.0.7 | MIT |
| desktop | `node_modules/pkijs` | 3.4.2 | BSD-3-Clause |
| desktop | `node_modules/pkijs/node_modules/@noble/hashes` | 1.8.0 | MIT |
| desktop | `node_modules/plist` | 3.1.0 | MIT |
| desktop | `node_modules/postject` | 1.0.0-alpha.6 | MIT |
| desktop | `node_modules/postject/node_modules/commander` | 9.5.0 | MIT |
| desktop | `node_modules/proc-log` | 6.1.0 | ISC |
| desktop | `node_modules/process-nextick-args` | 2.0.1 | MIT |
| desktop | `node_modules/progress` | 2.0.3 | MIT |
| desktop | `node_modules/promise-retry` | 2.0.1 | MIT |
| desktop | `node_modules/proper-lockfile` | 4.1.2 | MIT |
| desktop | `node_modules/pump` | 3.0.4 | MIT |
| desktop | `node_modules/pvtsutils` | 1.3.6 | MIT |
| desktop | `node_modules/pvutils` | 1.2.0 | MIT |
| desktop | `node_modules/quick-lru` | 5.1.1 | MIT |
| desktop | `node_modules/read-binary-file-arch` | 1.0.6 | MIT |
| desktop | `node_modules/readable-stream` | 2.3.8 | MIT |
| desktop | `node_modules/require-directory` | 2.1.1 | MIT |
| desktop | `node_modules/require-from-string` | 2.0.2 | MIT |
| desktop | `node_modules/resedit` | 1.7.2 | MIT |
| desktop | `node_modules/resolve-alpn` | 1.2.1 | MIT |
| desktop | `node_modules/responselike` | 2.0.1 | MIT |
| desktop | `node_modules/retry` | 0.12.0 | MIT |
| desktop | `node_modules/rimraf` | 2.6.3 | ISC |
| desktop | `node_modules/roarr` | 2.15.4 | BSD-3-Clause |
| desktop | `node_modules/safe-buffer` | 5.1.2 | MIT |
| desktop | `node_modules/sanitize-filename` | 1.6.4 | WTFPL OR ISC |
| desktop | `node_modules/sax` | 1.6.1 | BlueOak-1.0.0 |
| desktop | `node_modules/semver` | 7.8.5 | ISC |
| desktop | `node_modules/semver-compare` | 1.0.0 | MIT |
| desktop | `node_modules/serialize-error` | 7.0.1 | MIT |
| desktop | `node_modules/shebang-command` | 2.0.0 | MIT |
| desktop | `node_modules/shebang-regex` | 3.0.0 | MIT |
| desktop | `node_modules/signal-exit` | 3.0.7 | ISC |
| desktop | `node_modules/simple-update-notifier` | 2.0.0 | MIT |
| desktop | `node_modules/source-map` | 0.6.1 | BSD-3-Clause |
| desktop | `node_modules/source-map-support` | 0.5.21 | MIT |
| desktop | `node_modules/sprintf-js` | 1.1.3 | BSD-3-Clause |
| desktop | `node_modules/stat-mode` | 1.0.0 | MIT |
| desktop | `node_modules/string-width` | 4.2.3 | MIT |
| desktop | `node_modules/string_decoder` | 1.1.1 | MIT |
| desktop | `node_modules/strip-ansi` | 6.0.1 | MIT |
| desktop | `node_modules/sumchecker` | 3.0.1 | Apache-2.0 |
| desktop | `node_modules/supports-color` | 7.2.0 | MIT |
| desktop | `node_modules/tar` | 7.5.22 | BlueOak-1.0.0 |
| desktop | `node_modules/tar/node_modules/yallist` | 5.0.0 | BlueOak-1.0.0 |
| desktop | `node_modules/temp` | 0.9.4 | MIT |
| desktop | `node_modules/temp-file` | 3.4.0 | MIT |
| desktop | `node_modules/tiny-async-pool` | 1.3.0 | MIT |
| desktop | `node_modules/tiny-async-pool/node_modules/semver` | 5.7.2 | ISC |
| desktop | `node_modules/tiny-typed-emitter` | 2.1.0 | MIT |
| desktop | `node_modules/tinyglobby` | 0.2.17 | MIT |
| desktop | `node_modules/tmp` | 0.2.7 | MIT |
| desktop | `node_modules/tmp-promise` | 3.0.3 | MIT |
| desktop | `node_modules/truncate-utf8-bytes` | 1.0.2 | WTFPL |
| desktop | `node_modules/tslib` | 2.8.1 | 0BSD |
| desktop | `node_modules/type-fest` | 0.13.1 | (MIT OR CC0-1.0) |
| desktop | `node_modules/undici` | 7.30.1 | MIT |
| desktop | `node_modules/undici-types` | 7.24.6 | MIT |
| desktop | `node_modules/universalify` | 2.0.1 | MIT |
| desktop | `node_modules/unzipper` | 0.12.5 | MIT |
| desktop | `node_modules/unzipper/node_modules/fs-extra` | 11.3.1 | MIT |
| desktop | `node_modules/utf8-byte-length` | 1.0.5 | (WTFPL OR MIT) |
| desktop | `node_modules/util-deprecate` | 1.0.2 | MIT |
| desktop | `node_modules/webcrypto-core` | 1.9.2 | MIT |
| desktop | `node_modules/which` | 5.0.0 | ISC |
| desktop | `node_modules/wrap-ansi` | 7.0.0 | MIT |
| desktop | `node_modules/wrappy` | 1.0.2 | ISC |
| desktop | `node_modules/xmlbuilder` | 15.1.1 | MIT |
| desktop | `node_modules/y18n` | 5.0.8 | ISC |
| desktop | `node_modules/yallist` | 4.0.0 | ISC |
| desktop | `node_modules/yargs` | 17.7.3 | MIT |
| desktop | `node_modules/yargs-parser` | 21.1.1 | ISC |
| desktop | `node_modules/yocto-queue` | 0.1.0 | MIT |

## Backend: distribuciones presentes en el entorno local

Los metadatos son declaraciones de los paquetes y pueden contener clasificadores o texto abreviado; no son una lista cerrada de todas las combinaciones que se resuelvan en otros entornos.

| Paquete | Versión | Licencia o clasificador declarado |
|---|---|---|
| aiosqlite | 0.22.1 | License :: OSI Approved :: MIT License |
| alembic | 1.14.0 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.16.0 | MIT |
| APScheduler | 3.11.0 | MIT |
| asyncpg | 0.30.0 | Apache License, Version 2.0 |
| bcrypt | 4.0.1 | Apache License, Version 2.0 |
| cachetools | 5.5.2 | MIT |
| certifi | 2026.10.23 | MPL-2.0 |
| cffi | 2.1.1 | MIT-0 |
| chardet | 7.7.0 | 0BSD |
| charset-normalizer | 3.5.2 | MIT |
| click | 8.5.1 | BSD-3-Clause |
| colorama | 0.4.6 | License :: OSI Approved :: BSD License |
| cryptography | 44.0.0 | Apache-2.0 OR BSD-3-Clause |
| Deprecated | 1.3.1 | MIT |
| dnspython | 2.9.2 | ISC |
| email_validator | 2.2.0 | Unlicense |
| et_xmlfile | 2.0.0 | MIT |
| fastapi | 0.115.0 | License :: OSI Approved :: MIT License |
| google-api-core | 2.44.0 | Apache 2.0 |
| google-api-python-client | 2.149.0 | Apache 2.0 |
| google-auth | 2.36.0 | Apache 2.0 |
| google-auth-httplib2 | 0.4.4 | Apache 2.0 |
| google-auth-oauthlib | 1.2.1 | Apache 2.0 |
| googleapis-common-protos | 1.76.0 | Apache-2.0 |
| greenlet | 3.5.6 | MIT AND PSF-2.0 |
| h11 | 0.16.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httplib2 | 0.32.1 | MIT |
| httptools | 0.9.0 | MIT |
| httpx | 0.27.2 | BSD-3-Clause |
| idna | 3.20 | BSD-3-Clause |
| iniconfig | 2.3.1 | MIT |
| limits | 5.8.0 | MIT |
| lxml | 6.1.3 | BSD-3-Clause |
| Mako | 1.4.3 | MIT |
| MarkupSafe | 3.0.4 | BSD-3-Clause |
| oauthlib | 4.0.1 | BSD-3-Clause |
| openpyxl | 3.1.5 | MIT |
| opentelemetry-api | 1.45.2 | Apache-2.0 |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| passlib | 1.7.4 | BSD |
| pillow | 13.0.0 | MIT-CMU |
| pip | 24.0 | MIT |
| pluggy | 1.7.0 | MIT |
| proto-plus | 1.29.0 | Apache 2.0 |
| protobuf | 7.36.2 | 3-Clause BSD License |
| psycopg2-binary | 2.9.10 | LGPL with exceptions |
| pyasn1 | 0.6.5 | BSD-2-Clause |
| pyasn1_modules | 0.4.2 | BSD |
| pycparser | 3.12 | BSD-3-Clause |
| pydantic | 2.9.2 | MIT |
| pydantic-settings | 2.6.1 | MIT |
| pydantic_core | 2.23.4 | MIT |
| PyJWT | 2.10.1 | MIT |
| pyparsing | 3.3.3 | MIT |
| pypdf | 5.1.0 | License :: OSI Approved :: BSD License |
| pytest | 8.3.4 | MIT |
| pytest-asyncio | 0.24.0 | Apache 2.0 |
| python-docx | 1.1.2 | MIT |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| python-multipart | 0.0.12 | Apache-2.0 |
| PyYAML | 6.0.3 | MIT |
| reportlab | 4.2.5 | BSD license (see license.txt for details), Copyright (c) 2000-2022, ReportLab Inc. |
| requests | 2.34.2 | Apache-2.0 |
| requests-oauthlib | 2.0.0 | ISC |
| rsa | 4.9.1 | Apache-2.0 |
| ruff | 0.7.4 | MIT |
| setuptools | 65.5.0 | License :: OSI Approved :: MIT License |
| slowapi | 0.1.9 | MIT |
| sniffio | 1.3.1 | MIT OR Apache-2.0 |
| SQLAlchemy | 2.0.36 | MIT |
| starlette | 0.38.6 | BSD-3-Clause |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2024.2 | Apache-2.0 |
| tzlocal | 5.4.5 | MIT |
| uritemplate | 4.2.0 | BSD 3-Clause OR Apache-2.0 |
| urllib3 | 2.8.0 | MIT |
| uvicorn | 0.32.0 | BSD-3-Clause |
| watchfiles | 1.3.0 | MIT |
| websockets | 17.4 | BSD-3-Clause |
| wrapt | 2.5.2 | BSD-2-Clause |

## Incorporaciones de Office 1B

Comprobadas antes de instalar: `mammoth@1.13.0` BSD-2-Clause, `docx@9.15.3` MIT y `jszip@3.10.1` (MIT OR GPL-3.0-or-later; se elige MIT). Sus ramas permisivas son compatibles con GPL-3.0-or-later y requieren conservar los avisos. Evidencia local: `frontend/node_modules/{mammoth,docx,jszip}/LICENSE*` y los metadatos fijados en package-lock.json. Fuentes: [Mammoth](https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE), [docx](https://github.com/dolanmiu/docx/blob/master/LICENSE), [JSZip](https://github.com/Stuk/jszip/blob/v3.10.1/LICENSE.markdown). La tabla anterior conserva la instantánea previa y no pretende incluir estas incorporaciones ni sus nuevas transitivas.
