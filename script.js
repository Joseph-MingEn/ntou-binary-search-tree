const input = document.querySelector('#sequenceInput');
const nextButton = document.querySelector('#nextButton');
const resetButton = document.querySelector('#resetButton');
const exampleButton = document.querySelector('#exampleButton');
const animationButton = document.querySelector('#animationButton');
const animationButtonLabel = document.querySelector('#animationButtonLabel');
const svg = document.querySelector('#treeSvg');
const stage = document.querySelector('#treeStage');
const emptyState = document.querySelector('#emptyState');
const message = document.querySelector('#message');
const modeNote = document.querySelector('#modeNote');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const nextButtonLabel = document.querySelector('#nextButtonLabel');
const nodeCount = document.querySelector('#nodeCount');
const treeHeight = document.querySelector('#treeHeight');
const stepCount = document.querySelector('#stepCount');
const example = [48, 25, 72, 12, 36, 60, 90, 30, 42];
const MAX_NODES = 31;
const NODE_RADIUS = 24;
const X_GAP = 62;
const Y_GAP = 82;
const ANIMATION_INTERVAL = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 700;
let activeValues = null;
let insertedCount = 0;
let lastInsertedValue = null;
let root = null;
let mode = 'general';
let traversalOrder = [];
let traversalIndex = 0;
let animationRunning = false;
let animationTimer = null;
const modeLabels = { preorder: '前序', inorder: '中序', postorder: '後序' };

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

function insert(root, value, insertionOrder, depth = 0) {
  if (!root) return { value, depth, insertionOrder, left: null, right: null };
  if (value < root.value) root.left = insert(root.left, value, insertionOrder, depth + 1);
  else root.right = insert(root.right, value, insertionOrder, depth + 1);
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

function drawTree(root, visitedNodes = [], currentNode = null) {
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
  const visited = new Set(visitedNodes);
  points.forEach(({ node, x, y }) => {
    const cx = x + offsetX;
    const classes = ['node'];
    if (node === root) classes.push('root-node');
    if (visited.has(node)) classes.push('visited');
    if ((mode === 'general' && node.value === lastInsertedValue) || (mode !== 'general' && node === currentNode)) classes.push('current-visit');
    const group = svgElement('g', { class: classes.join(' '), transform: `translate(${cx} ${y})` });
    const title = svgElement('title');
    const visitPosition = traversalOrder.indexOf(node);
    const visitHint = mode !== 'general' && visitPosition >= 0 ? `，${modeLabels[mode]}遍歷第 ${visitPosition + 1} 個` : '';
    title.textContent = `${node.value}，${node === root ? '根節點' : '第 ' + (node.depth + 1) + ' 層'}${visitHint}`;
    const circle = svgElement('circle', { r: NODE_RADIUS });
    const label = svgElement('text', { 'text-anchor': 'middle', dy: '0.36em' });
    label.textContent = node.value;
    const orderNumber = mode === 'general' ? node.insertionOrder : visitPosition + 1;
    const badge = svgElement('g', { class: 'visit-badge', transform: 'translate(-17 -17)', 'aria-hidden': 'true' });
    const badgeCircle = svgElement('circle', { r: '9.5' });
    const badgeText = svgElement('text', { 'text-anchor': 'middle', dy: '0.35em' });
    badgeText.textContent = String(orderNumber);
    badge.append(badgeCircle, badgeText);
    group.append(title, circle, label, badge);
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
  if (mode !== 'general') {
    const total = traversalOrder.length;
    stepCount.textContent = `${traversalIndex} / ${total}`;
    nextButton.disabled = !root || traversalIndex >= total;
    return;
  }
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
  root = insert(root, value, insertedCount + 1);
  insertedCount += 1;
  lastInsertedValue = value;
  drawTree(root);
  traversalOrder = [];
  traversalIndex = 0;
  message.textContent = `已新增第 ${insertedCount} / ${activeValues.length} 個數字：${value}。`;
  if (insertedCount === activeValues.length) message.textContent += ' 數列插入完成。';
  message.className = 'message success';
  updateProgress();
}

function resetTree() {
  root = null;
  activeValues = null;
  insertedCount = 0;
  lastInsertedValue = null;
  traversalOrder = [];
  traversalIndex = 0;
  input.setAttribute('aria-invalid', 'false');
  drawTree(null);
  message.textContent = mode === 'general'
    ? '已重置；按「下一數字」從目前數列的第一個數字開始。'
    : '樹已清空；請切回一般模式逐個插入數字。';
  message.className = 'message';
  updateProgress();
}

function getTraversal(node, order, values = []) {
  if (!node) return values;
  if (order === 'preorder') values.push(node);
  getTraversal(node.left, order, values);
  if (order === 'inorder') values.push(node);
  getTraversal(node.right, order, values);
  if (order === 'postorder') values.push(node);
  return values;
}

function renderTraversal() {
  const visited = traversalOrder.slice(0, traversalIndex);
  drawTree(root, visited, visited[visited.length - 1] ?? null);
}

function updateModeControls() {
  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const isTraversal = mode !== 'general';
  nextButtonLabel.textContent = isTraversal ? '下一步' : '下一數字';
  modeNote.textContent = isTraversal
    ? `${modeLabels[mode]}遍歷：依序標示拜訪到的節點。`
    : '逐個插入數字，建立二元搜尋樹。';
  updateProgress();
}

function changeMode(nextMode) {
  mode = nextMode;
  traversalIndex = 0;
  traversalOrder = mode === 'general' ? [] : getTraversal(root, mode);
  updateModeControls();
  if (mode !== 'general') renderTraversal();
  else drawTree(root);
  if (mode === 'general') {
    message.textContent = root ? '已切回一般模式，按「下一數字」繼續插入。' : '一般模式：按「下一數字」逐個建立二元搜尋樹。';
  } else if (!root) {
    message.textContent = `已切換到${modeLabels[mode]}遍歷；請先切回一般模式建立樹。`;
  } else {
    message.textContent = `已切換到${modeLabels[mode]}遍歷，按「下一步」開始。`;
  }
  message.className = 'message';
}

function visitNextNode() {
  if (!root) {
    message.textContent = '請先切回一般模式，插入數字並建立樹。';
    message.className = 'message error';
    return;
  }
  if (!traversalOrder.length) traversalOrder = getTraversal(root, mode);
  if (traversalIndex >= traversalOrder.length) return;
  const node = traversalOrder[traversalIndex];
  traversalIndex += 1;
  renderTraversal();
  message.textContent = `${modeLabels[mode]}遍歷第 ${traversalIndex} / ${traversalOrder.length} 步：${node.value}。`;
  if (traversalIndex === traversalOrder.length) message.textContent += ' 遍歷完成。';
  message.className = 'message success';
  updateProgress();
}

function resetTraversal() {
  traversalIndex = 0;
  if (mode !== 'general') traversalOrder = getTraversal(root, mode);
  renderTraversal();
  message.textContent = root ? `已重置${modeLabels[mode]}遍歷；按「下一步」重新開始。` : '請先切回一般模式，建立一棵樹。';
  message.className = 'message';
  updateProgress();
}

function stopAnimation() {
  if (animationTimer !== null) window.clearTimeout(animationTimer);
  animationTimer = null;
  animationRunning = false;
  animationButton.setAttribute('aria-pressed', 'false');
  animationButtonLabel.textContent = '▶　播放演化動畫';
  animationButton.classList.remove('running');
}

function animationStep() {
  if (!animationRunning) return;
  if (mode === 'general') addNextNumber();
  else visitNextNode();

  const finished = mode === 'general'
    ? activeValues !== null && insertedCount >= activeValues.length
    : Boolean(root) && traversalIndex >= traversalOrder.length;
  if (finished || (mode !== 'general' && !root)) {
    stopAnimation();
    return;
  }
  animationTimer = window.setTimeout(animationStep, ANIMATION_INTERVAL);
}

function startAnimation() {
  if (mode === 'general') {
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
      lastInsertedValue = null;
      traversalOrder = [];
      traversalIndex = 0;
      drawTree(null);
    } else if (insertedCount >= activeValues.length) {
      insertedCount = 0;
      root = null;
      lastInsertedValue = null;
      drawTree(null);
    }
    updateProgress();
  } else {
    if (!root) {
      message.textContent = '請先切回一般模式，插入數字並建立樹。';
      message.className = 'message error';
      return;
    }
    if (!traversalOrder.length) traversalOrder = getTraversal(root, mode);
    if (traversalIndex >= traversalOrder.length) {
      traversalIndex = 0;
      renderTraversal();
      updateProgress();
    }
  }

  animationRunning = true;
  animationButton.setAttribute('aria-pressed', 'true');
  animationButtonLabel.textContent = '■　停止動畫';
  animationButton.classList.add('running');
  message.textContent = mode === 'general' ? '樹正在依序插入數字…' : `${modeLabels[mode]}遍歷動畫進行中…`;
  message.className = 'message';
  animationTimer = window.setTimeout(animationStep, 250);
}

function stepForward() {
  if (animationRunning) stopAnimation();
  if (mode === 'general') addNextNumber();
  else visitNextNode();
}

animationButton.addEventListener('click', () => {
  if (animationRunning) {
    stopAnimation();
    message.textContent = '演化動畫已停止。';
    message.className = 'message';
  } else startAnimation();
});
nextButton.addEventListener('click', stepForward);
resetButton.addEventListener('click', () => {
  stopAnimation();
  if (mode === 'general') resetTree();
  else resetTraversal();
});
modeButtons.forEach((button) => button.addEventListener('click', () => {
  stopAnimation();
  changeMode(button.dataset.mode);
}));
exampleButton.addEventListener('click', () => {
  stopAnimation();
  input.value = example.join(', ');
  if (mode !== 'general') changeMode('general');
  resetTree();
  message.textContent = '已載入範例數列，按「下一數字」開始插入。';
});
input.addEventListener('input', () => {
  if (animationRunning) stopAnimation();
  const parsed = parseSequence(input.value);
  input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
  if (activeValues) {
    if (parsed.error || !sameSequence(parsed.values)) {
      resetTree();
      input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
      message.textContent = parsed.error || (mode === 'general'
        ? '數列已變更，按「下一數字」從第一個數字開始。'
        : '數列已變更；請切回一般模式重新建立樹。');
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
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') stepForward();
});
window.addEventListener('resize', () => {
  if (mode === 'general') drawTree(root);
  else renderTraversal();
});

drawTree(null);
updateModeControls();
updateProgress();
