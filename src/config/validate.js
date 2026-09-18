const MAX_CONFIG_BYTES = 64 * 1024;

export async function loadValidatedJson(configUrl, schemaUrl) {
  const configTarget = sameOriginUrl(configUrl);
  const schemaTarget = sameOriginUrl(schemaUrl);
  const [configResponse, schemaResponse] = await Promise.all([
    fetch(configTarget, { cache: 'no-store', credentials: 'same-origin' }),
    fetch(schemaTarget, { cache: 'no-store', credentials: 'same-origin' })
  ]);

  if (!configResponse.ok) throw new Error('Config load failed: ' + configResponse.status);
  if (!schemaResponse.ok) throw new Error('Schema load failed: ' + schemaResponse.status);

  const configText = await configResponse.text();
  const schemaText = await schemaResponse.text();
  if (configText.length > MAX_CONFIG_BYTES || schemaText.length > MAX_CONFIG_BYTES) {
    throw new Error('Config or schema exceeds size limit');
  }

  const config = JSON.parse(configText);
  const schema = JSON.parse(schemaText);
  const errors = [];
  validateNode(config, schema, '$', errors);
  if (errors.length) throw new Error('Invalid config: ' + errors.slice(0, 8).join('; '));
  return deepFreeze(config);
}

function sameOriginUrl(path) {
  const url = new URL(path, window.location.href);
  if (url.origin !== window.location.origin) throw new Error('Cross-origin config URLs are not allowed');
  return url.href;
}

function validateNode(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') {
    errors.push(path + ': invalid schema');
    return;
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(path + ': wrong constant');
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(path + ': unsupported value');
    return;
  }

  switch (schema.type) {
    case 'object': return validateObject(value, schema, path, errors);
    case 'array': return validateArray(value, schema, path, errors);
    case 'number': return validateNumber(value, schema, path, errors);
    case 'integer': return validateInteger(value, schema, path, errors);
    case 'string': return validateString(value, schema, path, errors);
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(path + ': must be boolean');
      return;
    default:
      errors.push(path + ': unsupported schema type');
  }
}

function validateObject(value, schema, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(path + ': must be object');
    return;
  }
  const properties = schema.properties || {};
  for (const key of schema.required || []) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(path + '.' + key + ': required');
  }
  for (const [key, child] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      if (schema.additionalProperties === false) errors.push(path + '.' + key + ': unknown property');
      continue;
    }
    validateNode(child, properties[key], path + '.' + key, errors);
  }
}

function validateArray(value, schema, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(path + ': must be array');
    return;
  }
  if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(path + ': too few items');
  if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(path + ': too many items');
  value.forEach((item, index) => validateNode(item, schema.items, path + '[' + index + ']', errors));
}

function validateNumber(value, schema, path, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(path + ': must be finite number');
    return;
  }
  validateRange(value, schema, path, errors);
}

function validateInteger(value, schema, path, errors) {
  if (!Number.isSafeInteger(value)) {
    errors.push(path + ': must be safe integer');
    return;
  }
  validateRange(value, schema, path, errors);
}

function validateRange(value, schema, path, errors) {
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(path + ': below minimum');
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(path + ': above maximum');
}

function validateString(value, schema, path, errors) {
  if (typeof value !== 'string') {
    errors.push(path + ': must be string');
    return;
  }
  if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(path + ': too short');
  if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(path + ': too long');
  if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(path + ': invalid format');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}