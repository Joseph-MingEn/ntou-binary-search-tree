const input = document.querySelector('#sequenceInput');
const nextButton = document.querySelector('#nextButton');
const resetButton = document.querySelector('#resetButton');
const exampleButton = document.querySelector('#exampleButton');
const svg = document.querySelector('#treeSvg');
const stage = document.querySelector('#treeStage');
const emptyState = document.querySelector('#emptyState');
const message = document.querySelector('#message');
const nodeCount = document.querySelector('#nodeCount');
const treeHeight = document.querySelector('#treeHeight');
const stepCount = document.querySelector('#stepCount');
const example = [48, 25, 72, 12, 36, 60, 90, 30, 42];
const MAX_NODES = 31;
const NODE_RADIUS = 24;
const X_GAP = 62;
const Y_GAP = 82;
let activeValues = null;
let insertedCount = 0;
let root = null;

function parseSequence(value) {
  const parts = value.trim().split(/[\s,，、]+/).filter(Boolean);
  if (!parts.length) return { error: '請先輸入至少一個整數。' };
  if (parts.length > MAX_NODES) return { error: `目前輸入 ${parts.length} 個數字，請減少到 ${MAX_NODES} 個以內。` };
  const values = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return { error: `「${part}」不是有效的整數，請檢查輸入格式。` };
    const value = Number(part);
    if (!Number.isSafeInteger(value)) return { error: `「${part}」超出可安全處理的整數範圍。` };
    values.push(value);
  }
  const seen = new Set();
  const duplicate = values.find((value) => seen.has(value) || !seen.add(value));
  if (duplicate !== undefined) return { error: `數字 ${duplicate} 重複了，請輸入不重複的數列。` };
  return { values };
}

function insert(root, value, depth = 0) {
  if (!root) return { value, depth, left: null, right: null };
  if (value < root.value) root.left = insert(root.left, value, depth + 1);
  else root.right = insert(root.right, value, depth + 1);
  return root;
}

function measure(root) {
  let count = 0;
  let deepest = 0;
  function visit(node, depth) {
    if (!node) return;
    count += 1;
    deepest = Math.max(deepest, depth);
    visit(node.left, depth + 1);
    visit(node.right, depth + 1);
  }
  visit(root, 0);
  return { count, height: root ? deepest + 1 : 0 };
}

function layout(root) {
  const points = [];
  let inorderIndex = 0;
  function visit(node, depth) {
    if (!node) return;
    visit(node.left, depth + 1);
    points.push({ node, x: inorderIndex * X_GAP, y: depth * Y_GAP + 44 });
    inorderIndex += 1;
    visit(node.right, depth + 1);
  }
  visit(root, 0);
  return points;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function drawTree(root) {
  svg.replaceChildren();
  if (!root) {
    svg.hidden = true;
    emptyState.hidden = false;
    nodeCount.textContent = '0';
    treeHeight.textContent = '0';
    return;
  }
  emptyState.hidden = true;
  svg.hidden = false;
  const points = layout(root);
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(stage.clientWidth, maxX + NODE_RADIUS * 2 + 48);
  const height = maxY + NODE_RADIUS * 2 + 30;
  const offsetX = Math.max(24, (width - (maxX + NODE_RADIUS * 2)) / 2);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;

  const positions = new Map(points.map(({ node, x, y }) => [node, { x: x + offsetX, y }]));
  const edges = svgElement('g', { class: 'edges' });
  points.forEach(({ node }) => {
    const from = positions.get(node);
    for (const child of [node.left, node.right]) {
      if (!child) continue;
      const to = positions.get(child);
      edges.append(svgElement('path', {
        class: `edge ${child.value < node.value ? 'edge-left' : 'edge-right'}`,
        d: `M ${from.x} ${from.y + NODE_RADIUS} C ${from.x} ${from.y + 54}, ${to.x} ${to.y - 54}, ${to.x} ${to.y - NODE_RADIUS}`,
      }));
    }
  });
  svg.append(edges);

  const nodes = svgElement('g', { class: 'nodes' });
  points.forEach(({ node, x, y }) => {
    const cx = x + offsetX;
    const group = svgElement('g', { class: `node ${node === root ? 'root-node' : ''}`, transform: `translate(${cx} ${y})` });
    const title = svgElement('title');
    title.textContent = `${node.value}，${node === root ? '根節點' : '第 ' + (node.depth + 1) + ' 層'}`;
    const circle = svgElement('circle', { r: NODE_RADIUS });
    const label = svgElement('text', { 'text-anchor': 'middle', dy: '0.36em' });
    label.textContent = node.value;
    group.append(title, circle, label);
    nodes.append(group);
  });
  svg.append(nodes);
  const stats = measure(root);
  nodeCount.textContent = String(stats.count);
  treeHeight.textContent = String(stats.height);
}

function sameSequence(values) {
  return activeValues !== null && activeValues.length === values.length && activeValues.every((value, index) => value === values[index]);
}

function updateProgress() {
  const parsed = parseSequence(input.value);
  if (parsed.error) {
    stepCount.textContent = `${insertedCount} / —`;
    nextButton.disabled = false;
    return;
  }
  const matches = sameSequence(parsed.values);
  stepCount.textContent = `${matches ? insertedCount : 0} / ${parsed.values.length}`;
  nextButton.disabled = matches && insertedCount >= parsed.values.length;
}

function addNextNumber() {
  const parsed = parseSequence(input.value);
  input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
  if (parsed.error) {
    message.textContent = parsed.error;
    message.className = 'message error';
    return;
  }

  if (!sameSequence(parsed.values)) {
    activeValues = parsed.values;
    insertedCount = 0;
    root = null;
  }
  if (insertedCount >= activeValues.length) {
    message.textContent = '數列已全部插入。按「重置」可以重新開始。';
    message.className = 'message success';
    updateProgress();
    return;
  }

  const value = activeValues[insertedCount];
  root = insert(root, value);
  insertedCount += 1;
  drawTree(root);
  message.textContent = `已新增第 ${insertedCount} / ${activeValues.length} 個數字：${value}。`;
  if (insertedCount === activeValues.length) message.textContent += ' 數列插入完成。';
  message.className = 'message success';
  updateProgress();
}

function resetTree() {
  root = null;
  activeValues = null;
  insertedCount = 0;
  input.setAttribute('aria-invalid', 'false');
  drawTree(null);
  message.textContent = '已重置；按「下一數字」從目前數列的第一個數字開始。';
  message.className = 'message';
  updateProgress();
}

nextButton.addEventListener('click', addNextNumber);
resetButton.addEventListener('click', resetTree);
exampleButton.addEventListener('click', () => {
  input.value = example.join(', ');
  resetTree();
  message.textContent = '已載入範例數列，按「下一數字」開始插入。';
});
input.addEventListener('input', () => {
  const parsed = parseSequence(input.value);
  input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
  if (activeValues) {
    if (parsed.error || !sameSequence(parsed.values)) {
      resetTree();
      input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
      message.textContent = parsed.error || '數列已變更，按「下一數字」從第一個數字開始。';
      message.className = parsed.error ? 'message error' : 'message';
      return;
    }
  }
  updateProgress();
  if (message.classList.contains('error') && !parsed.error) {
    message.textContent = '輸入已修正，按「下一數字」繼續。';
    message.className = 'message';
  }
});
input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addNextNumber();
});
window.addEventListener('resize', () => {
  drawTree(root);
});

drawTree(null);
updateProgress();
