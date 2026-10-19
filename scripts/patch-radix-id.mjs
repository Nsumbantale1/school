/**
 * Radix assigns menu/dialog ids with React.useId() during the first render.
 * In this Next.js + React 19 combination those ids differ between the server
 * HTML and the browser, so every dashboard load shows a permanent "1 Issue"
 * hydration error on the colour-theme menu.
 *
 * Keep the id empty until after hydration, then assign the client id.
 * Re-applied on install because the change lives in node_modules.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const marker = "SOFA_STABLE_RADIX_ID";

const files = {
  mjs: {
    file: path.join(root, "node_modules/@radix-ui/react-id/dist/index.mjs"),
    from: `function useId(deterministicId) {
  const [id, setId] = React.useState(useReactId());
  useLayoutEffect(() => {
    if (!deterministicId) setId((reactId) => reactId ?? String(count++));
  }, [deterministicId]);
  return deterministicId || (id ? \`radix-\${id}\` : "");
}`,
    to: `function useId(deterministicId) {
  // ${marker}: do not put React.useId() into the server HTML.
  const reactId = useReactId();
  const [id, setId] = React.useState("");
  useLayoutEffect(() => {
    if (!deterministicId) setId(reactId ? \`radix-\${reactId}\` : String(count++));
  }, [deterministicId, reactId]);
  return deterministicId || id;
}`,
  },
  cjs: {
    file: path.join(root, "node_modules/@radix-ui/react-id/dist/index.js"),
    from: `function useId(deterministicId) {
  const [id, setId] = React.useState(useReactId());
  (0, import_react_use_layout_effect.useLayoutEffect)(() => {
    if (!deterministicId) setId((reactId) => reactId ?? String(count++));
  }, [deterministicId]);
  return deterministicId || (id ? \`radix-\${id}\` : "");
}`,
    to: `function useId(deterministicId) {
  // ${marker}: do not put React.useId() into the server HTML.
  const reactId = useReactId();
  const [id, setId] = React.useState("");
  (0, import_react_use_layout_effect.useLayoutEffect)(() => {
    if (!deterministicId) setId(reactId ? \`radix-\${reactId}\` : String(count++));
  }, [deterministicId, reactId]);
  return deterministicId || id;
}`,
  },
};

for (const { file, from, to } of Object.values(files)) {
  if (!fs.existsSync(file)) {
    console.warn(`skip missing ${file}`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(marker)) {
    console.log(`already patched ${path.relative(root, file)}`);
    continue;
  }
  if (!source.includes(from)) {
    console.error(`could not find the Radix useId function in ${file}`);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(file, source.replace(from, to));
  console.log(`patched ${path.relative(root, file)}`);
}
