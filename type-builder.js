const fs = require("fs");
const path = require("path");

// Define the path to the Swagger file and output directory
const SWAGGER_FILE = path.join(__dirname, "./test.json");
const OUTPUT_DIR = path.join(__dirname, "./interfaces");
const INDEX_FILE = path.join(OUTPUT_DIR, "index.ts");

const processedTypes = new Set();

// Helper function to resolve $ref
const resolveRef = (ref, definitions) => {
  const refPath = ref
    .replace(/^#\/definitions\//, "")
    .replace(/^#\/components\/schemas\//, "");
  return definitions[refPath];
};

// Function to get the type name from a $ref
const getRefTypeName = (ref) => {
  return ref
    .replace(/^#\/definitions\//, "")
    .replace(/^#\/components\/schemas\//, "");
};

// Function to convert a Swagger schema to a TypeScript type
const convertSchemaToTypes = (name, schema, definitions, imports) => {
  if (schema.$ref) {
    const refType = getRefTypeName(schema.$ref);
    if (!imports.includes(refType)) {
      imports.push(refType);
    }
    return refType;
  }

  if (schema.allOf) {
    const allOfTypes = schema.allOf
      .map((subSchema) => {
        if (subSchema.$ref) {
          const refType = getRefTypeName(subSchema.$ref);
          if (!imports.includes(refType)) {
            imports.push(refType);
          }
          return refType;
        }
        return convertSchemaToTypes("", subSchema, definitions, imports);
      })
      .join(" & ");
    return allOfTypes;
  }

  if (schema.anyOf) {
    const anyOfTypes = schema.anyOf
      .map((subSchema) => {
        if (subSchema.$ref) {
          const refType = getRefTypeName(subSchema.$ref);
          if (!imports.includes(refType)) {
            imports.push(refType);
          }
          return refType;
        }
        return convertSchemaToTypes("", subSchema, definitions, imports);
      })
      .join(" | ");
    return anyOfTypes;
  }

  if (schema.oneOf) {
    const oneOfTypes = schema.oneOf
      .map((subSchema) => {
        if (subSchema.$ref) {
          const refType = getRefTypeName(subSchema.$ref);
          if (!imports.includes(refType)) {
            imports.push(refType);
          }
          return refType;
        }
        return convertSchemaToTypes("", subSchema, definitions, imports);
      })
      .join(" | ");
    return oneOfTypes;
  }

  if (schema.enum) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (!schema.properties) {
    if (schema.type) {
      switch (schema.type) {
        case "integer":
          return "number";
        case "array":
          return `${convertSchemaToTypes(
            "",
            schema.items,
            definitions,
            imports,
          )}[]`;
        case "object":
          if (schema.additionalProperties) {
            const additionalPropertiesType = convertSchemaToTypes(
              "",
              schema.additionalProperties,
              definitions,
              imports,
            );
            return `{ [key: string]: ${additionalPropertiesType}; }`;
          }
          return "{}";
        case "string":
          return "string";
        default:
          return schema.type;
      }
    }

    return "{}";
  }

  let types = `{\n`;
  for (const [key, value] of Object.entries(schema.properties)) {
    let type;
    if (value.$ref) {
      type = getRefTypeName(value.$ref);
      if (!processedTypes.has(type)) {
        processDefinition(type, resolveRef(value.$ref, definitions));
      }
      if (!imports.includes(type)) {
        imports.push(type);
      }
    } else if (value.allOf || value.anyOf || value.oneOf) {
      type = convertSchemaToTypes("", value, definitions, imports);
    } else {
      switch (value.type) {
        case "integer":
          type = "number";
          break;
        case "array":
          type = `${convertSchemaToTypes(
            "",
            value.items,
            definitions,
            imports,
          )}[]`;
          break;
        case "object":
          type = convertSchemaToTypes("", value, definitions, imports);
          break;
        case "string":
          type = "string";
          break;
        default:
          type = value.type;
      }
    }
    if (value.nullable) {
      type += " | null";
    }
    types += `  ${key}: ${type};\n`;
  }
  types += "}";
  return types;
};

// Function to parse the Swagger file and generate TypeScript types
const generateTypes = () => {
  if (!fs.existsSync(SWAGGER_FILE)) {
    console.error("Swagger file not found!");
    return;
  }

  const swaggerData = JSON.parse(fs.readFileSync(SWAGGER_FILE, "utf8"));
  const definitions = swaggerData.definitions || swaggerData.components.schemas;
  const paths = swaggerData.paths;

  if (!definitions) {
    console.error("No definitions found in Swagger file!");
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  let indexContent = "";

  const processDefinition = (name, schema) => {
    if (!processedTypes.has(name)) {
      const imports = [];
      const types = convertSchemaToTypes(name, schema, definitions, imports);
      let content = "";
      if (imports.length) {
        content +=
          imports.map((i) => `import { ${i} } from './${i}';`).join("\n") +
          "\n";
      }
      if (schema.enum) {
        content += `export type ${name} = ${types};\n`;
      } else {
        content += `export interface ${name} ${types};\n`;
      }
      const filePath = path.join(OUTPUT_DIR, `${name}.ts`);
      fs.writeFileSync(filePath, content);
      indexContent += `export * from './${name}';\n`;
      processedTypes.add(name);
    }
  };

  const processParameters = (pathName, parameters) => {
    const initialName = pathName.split("/").pop() + "RequestModel";
    const name = initialName.charAt(0).toUpperCase() + initialName.slice(1);
    if (!processedTypes.has(name)) {
      let types = `{\n`;
      parameters.forEach((param) => {
        const { name: paramName, schema, type, required } = param;
        let paramType =
          type || convertSchemaToTypes("", schema, definitions, []);
        if (!required) {
          paramType += " | undefined";
        }
        types += `  ${paramName}: ${paramType};\n`;
      });
      types += "}";
      const content = `export interface ${name} ${types};\n`;
      const filePath = path.join(OUTPUT_DIR, `${name}.ts`);
      fs.writeFileSync(filePath, content);
      indexContent += `export * from './${name}';\n`;
      processedTypes.add(name);
    }
  };

  // Process definitions
  for (const [name, schema] of Object.entries(definitions)) {
    processDefinition(name, schema);
  }

  // Process paths for parameters
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (details.parameters) {
        processParameters(path, details.parameters);
      }
    }
  }

  fs.writeFileSync(INDEX_FILE, indexContent);
  console.log("TypeScript types generated successfully!");
};

// Run the type generation
generateTypes();
