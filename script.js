const input = document.querySelector('#sequenceInput');
const buildButton = document.querySelector('#buildButton');
const resetButton = document.querySelector('#resetButton');
const exampleButton = document.querySelector('#exampleButton');
const addButton = document.querySelector('#addButton');
const popButton = document.querySelector('#popButton');
const previousButton = document.querySelector('#previousButton');
const nextButton = document.querySelector('#nextButton');
const playButton = document.querySelector('#playButton');
const newNumberInput = document.querySelector('#newNumberInput');
const svg = document.querySelector('#treeSvg');
const stage = document.querySelector('#treeStage');
const emptyState = document.querySelector('#emptyState');
const arrayView = document.querySelector('#arrayView');
const message = document.querySelector('#message');
const nodeCount = document.querySelector('#nodeCount');
const treeHeight = document.querySelector('#treeHeight');
const maxValue = document.querySelector('#maxValue');
const stepCount = document.querySelector('#stepCount');
const extractedList = document.querySelector('#extractedValues');
const extractedCount = document.querySelector('#extractedCount');

const MAX_NODES = 31;
const NODE_RADIUS = 24;
const LEVEL_GAP = 82;
const PLAY_INTERVAL = 850;
let heap = [];
let poppedValues = [];
let highlighted = new Set();
let frames = [];
let frameIndex = 0;
let playTimer = null;

function parseSequence(text) {
  const parts = text.trim().split(/[\s,，、]+/).filter(Boolean);
  if (!parts.length) return { error: '請先輸入至少一個整數。' };
  if (parts.length > MAX_NODES) return { error: `最多輸入 ${MAX_NODES} 個數字。` };
  const values = [];
  for (const part of parts) {
    if (!/^[+-]?\d+$/.test(part)) return { error: `「${part}」不是有效的整數。` };
    const value = Number(part);
    if (!Number.isSafeInteger(value)) return { error: `「${part}」超出可安全處理的整數範圍。` };
    if (values.includes(value)) return { error: `數字 ${value} 重複了，請輸入不重複的數列。` };
    values.push(value);
  }
  return { values };
}

function addFrame(targetFrames, values, focus, text, extracted = poppedValues) {
  targetFrames.push({ heap: [...values], extracted: [...extracted], focus: [...focus], message: text });
}

function traceInsert(values, value, targetFrames) {
  let index = values.length;
  values.push(value);
  addFrame(targetFrames, values, [index], `將 ${value} 放到索引 ${index}（由左至右補入下一個空位）。`);
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    addFrame(targetFrames, values, [parent, index], `比較父節點 ${values[parent]} 與子節點 ${values[index]}。`);
    if (values[parent] >= values[index]) break;
    [values[parent], values[index]] = [values[index], values[parent]];
    addFrame(targetFrames, values, [parent, index], `${values[parent]} 大於 ${values[index]}，交換兩個節點，讓較大值往上。`);
    index = parent;
  }
}

function tracePop(values, targetFrames, history = poppedValues) {
  const removed = values[0];
  const nextHistory = [...history, removed];
  if (values.length === 1) {
    values.pop();
    addFrame(targetFrames, values, [], `取出最大值 ${removed}，堆已清空。`, nextHistory);
    return;
  }
  const moved = values.pop();
  values[0] = moved;
  addFrame(targetFrames, values, [0], `取出最大值 ${removed}，把最後一個節點 ${moved} 移到根部。`, nextHistory);
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= values.length) {
      addFrame(targetFrames, values, [index], `索引 ${index} 的節點沒有子節點，堆序已恢復。`, nextHistory);
      break;
    }
    let largerChild = left;
    const compared = [index, left];
    if (right < values.length) {
      compared.push(right);
      if (values[right] > values[left]) largerChild = right;
    }
    const childDescription = right < values.length
      ? `比較左右子節點 ${values[left]} 與 ${values[right]}`
      : `檢查唯一子節點 ${values[left]}`;
    const chosenDescription = right < values.length
      ? `選索引 ${largerChild} 的較大子節點 ${values[largerChild]}`
      : `選索引 ${largerChild} 的子節點 ${values[largerChild]}`;
    if (values[largerChild] <= values[index]) {
      addFrame(targetFrames, values, compared, `${childDescription}；${chosenDescription}仍不大於父節點 ${values[index]}，堆序恢復完成。`, nextHistory);
      break;
    }
    addFrame(targetFrames, values, compared, `${childDescription}；${chosenDescription}大於父節點 ${values[index]}，需要交換。`, nextHistory);
    [values[index], values[largerChild]] = [values[largerChild], values[index]];
    addFrame(targetFrames, values, [index, largerChild], `將較大的子節點 ${values[index]} 上移，繼續往下檢查。`, nextHistory);
    index = largerChild;
  }
}

function traceBuildMaxHeap(values, targetFrames) {
  const heapSize = values.length;
  for (let start = Math.floor(heapSize / 2) - 1; start >= 0; start -= 1) {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= heapSize) break;
      let largerChild = left;
      const compared = [index, left];
      if (right < heapSize) {
        compared.push(right);
        if (values[right] > values[left]) largerChild = right;
      }
      const childText = right < heapSize
        ? `比較左右子節點 ${values[left]} 與 ${values[right]}，選較大的 ${values[largerChild]}`
        : `檢查唯一子節點 ${values[left]}`;
      if (values[largerChild] <= values[index]) {
        addFrame(targetFrames, values, compared, `${childText}不大於父節點 ${values[index]}，此分支符合最大堆。`);
        break;
      }
      addFrame(targetFrames, values, compared, `${childText}大於父節點 ${values[index]}，先交換以建立最大堆。`);
      [values[index], values[largerChild]] = [values[largerChild], values[index]];
      addFrame(targetFrames, values, [index, largerChild], `將較大的子節點 ${values[index]} 上移，繼續調整此子樹。`);
      index = largerChild;
    }
  }
  addFrame(targetFrames, values, [], `最大堆已建立，根節點 ${values[0]} 是目前最大值。`);
}

function isMaxHeap(values) {
  for (let parent = 0; parent < Math.floor(values.length / 2); parent += 1) {
    const left = parent * 2 + 1;
    const right = left + 1;
    if (values[parent] < values[left] || right < values.length && values[parent] < values[right]) return false;
  }
  return true;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function nodePosition(index, width) {
  const depth = Math.floor(Math.log2(index + 1));
  const firstAtLevel = (2 ** depth) - 1;
  const position = index - firstAtLevel;
  const slots = 2 ** depth;
  return { x: ((position + 0.5) / slots) * width, y: 48 + depth * LEVEL_GAP };
}

function drawHeap() {
  svg.replaceChildren();
  const isEmpty = heap.length === 0;
  svg.hidden = isEmpty;
  emptyState.hidden = !isEmpty;
  arrayView.replaceChildren();
  nodeCount.textContent = String(heap.length);
  const height = heap.length ? Math.floor(Math.log2(heap.length)) + 1 : 0;
  treeHeight.textContent = String(height);
  maxValue.textContent = heap.length ? String(heap[0]) : '—';
  popButton.disabled = isEmpty || frames.length > 0 && frameIndex < frames.length - 1;
  if (isEmpty) {
    drawArrayView();
    return;
  }

  const deepest = height - 1;
  const minWidth = Math.max(stage.clientWidth, (2 ** deepest) * 72 + 40, 520);
  const drawWidth = minWidth - 40;
  const svgHeight = 48 + deepest * LEVEL_GAP + NODE_RADIUS * 2 + 32;
  svg.setAttribute('viewBox', `0 0 ${minWidth} ${svgHeight}`);
  svg.setAttribute('width', minWidth);
  svg.setAttribute('height', svgHeight);
  svg.style.width = `${minWidth}px`;
  svg.style.height = `${svgHeight}px`;

  const points = heap.map((value, index) => ({ value, index, ...nodePosition(index, drawWidth) }));
  const offset = 20;
  const edges = svgElement('g', { class: 'edges' });
  points.forEach((point) => {
    const left = point.index * 2 + 1;
    for (const childIndex of [left, left + 1]) {
      if (childIndex >= points.length) continue;
      const child = points[childIndex];
      const direction = childIndex === left ? 'left' : 'right';
      edges.append(svgElement('path', {
        class: `edge edge-${direction}`,
        d: `M ${point.x + offset} ${point.y + NODE_RADIUS} C ${point.x + offset} ${point.y + 52}, ${child.x + offset} ${child.y - 52}, ${child.x + offset} ${child.y - NODE_RADIUS}`,
      }));
    }
  });
  svg.append(edges);

  const nodes = svgElement('g', { class: 'nodes' });
  points.forEach((point) => {
    const classes = ['node'];
    if (point.index === 0) classes.push('root-node');
    if (highlighted.has(point.index)) classes.push('highlighted');
    const group = svgElement('g', { class: classes.join(' '), transform: `translate(${point.x + offset} ${point.y})` });
    const title = svgElement('title');
    title.textContent = `索引 ${point.index}，數值 ${point.value}${point.index === 0 ? '，根節點，最大值' : ''}`;
    const circle = svgElement('circle', { r: NODE_RADIUS });
    const digits = point.value.toString().length;
    const label = svgElement('text', { 'text-anchor': 'middle', dy: '0.36em', 'font-size': digits > 11 ? '7' : digits > 7 ? '9' : '12' });
    label.textContent = point.value;
    const badge = svgElement('g', { class: 'index-badge', transform: 'translate(-17 -17)', 'aria-hidden': 'true' });
    const badgeCircle = svgElement('circle', { r: '9.5' });
    const badgeText = svgElement('text', { 'text-anchor': 'middle', dy: '0.35em' });
    badgeText.textContent = point.index;
    badge.append(badgeCircle, badgeText);
    group.append(title, circle, label, badge);
    nodes.append(group);

  });
  svg.append(nodes);
  drawArrayView();
}

function drawArrayView() {
  arrayView.replaceChildren();
  heap.forEach((value, index) => {
    const cell = document.createElement('span');
    cell.className = `array-cell${index === 0 ? ' array-root' : ''}${highlighted.has(index) ? ' array-highlighted' : ''}`;
    cell.innerHTML = '<small></small><b></b>';
    cell.querySelector('small').textContent = index;
    cell.querySelector('b').textContent = value;
    arrayView.append(cell);
  });
  extractedCount.textContent = `${poppedValues.length} 個`;
  extractedList.replaceChildren();
  if (!poppedValues.length) {
    const hint = document.createElement('small');
    hint.textContent = '取出結果會依序顯示在這裡';
    extractedList.append(hint);
  }
  poppedValues.forEach((value, index) => {
    const cell = document.createElement('span');
    cell.className = 'extracted-chip';
    cell.innerHTML = '<small></small><b></b>';
    cell.querySelector('small').textContent = `第 ${index + 1} 個`;
    cell.querySelector('b').textContent = value;
    extractedList.append(cell);
  });
}

function updatePlaybackControls() {
  const last = Math.max(0, frames.length - 1);
  stepCount.textContent = `${frames.length ? frameIndex + 1 : 0} / ${frames.length}`;
  previousButton.disabled = !frames.length || frameIndex <= 0 || Boolean(playTimer);
  nextButton.disabled = !frames.length || frameIndex >= last || Boolean(playTimer);
  playButton.disabled = !frames.length || frameIndex >= last && !playTimer;
  playButton.setAttribute('aria-pressed', String(Boolean(playTimer)));
  playButton.textContent = playTimer ? '■　停止播放' : '▶　自動播放';
}

function showFrame(index) {
  if (!frames.length) return;
  frameIndex = Math.max(0, Math.min(index, frames.length - 1));
  const frame = frames[frameIndex];
  heap = [...frame.heap];
  poppedValues = [...(frame.extracted ?? [])];
  highlighted = new Set(frame.focus);
  drawHeap();
  setMessage(frame.message, frameIndex === frames.length - 1 ? 'success' : '');
  updatePlaybackControls();
}

function stopPlayback() {
  if (playTimer) window.clearInterval(playTimer);
  playTimer = null;
  updatePlaybackControls();
}

function playNext() {
  if (frameIndex >= frames.length - 1) {
    stopPlayback();
    return;
  }
  showFrame(frameIndex + 1);
  if (frameIndex >= frames.length - 1) stopPlayback();
}

function setTimeline(newFrames) {
  stopPlayback();
  frames = newFrames;
  showFrame(0);
}

function buildHeap() {
  const parsed = parseSequence(input.value);
  input.setAttribute('aria-invalid', String(Boolean(parsed.error)));
  if (parsed.error) {
    setMessage(parsed.error, 'error');
    return;
  }
  poppedValues = [];
  const working = [];
  const newFrames = [];
  addFrame(newFrames, working, [], '準備開始：依輸入順序把數字放入完全二元樹。');
  parsed.values.forEach((value) => traceInsert(working, value, newFrames));
  setTimeline(newFrames);
}

function addNumber() {
  const raw = newNumberInput.value.trim();
  if (!/^[+-]?\d+$/.test(raw)) {
    setMessage('請輸入一個有效的整數。', 'error');
    newNumberInput.focus();
    return;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    setMessage('這個數字超出可安全處理的整數範圍。', 'error');
    newNumberInput.focus();
    return;
  }
  if (heap.includes(value)) {
    setMessage(`數字 ${value} 已在堆中，請輸入不重複的數字。`, 'error');
    newNumberInput.focus();
    return;
  }
  if (heap.length >= MAX_NODES) {
    setMessage(`最多顯示 ${MAX_NODES} 個節點，請先取出最大值或清空。`, 'error');
    return;
  }
  const working = [...heap];
  const newFrames = [];
  addFrame(newFrames, working, [], `準備插入 ${value}。`);
  traceInsert(working, value, newFrames);
  setTimeline(newFrames);
  newNumberInput.value = '';
}

function removeMax() {
  if (!heap.length) return;
  const working = [...heap];
  const history = [...poppedValues];
  const newFrames = [];
  addFrame(newFrames, working, [], '取出前先檢查目前排列是否符合最大堆。', history);
  if (isMaxHeap(working)) {
    addFrame(newFrames, working, [], `排列已符合最大堆，根節點 ${working[0]} 是最大值。`, history);
  } else {
    traceBuildMaxHeap(working, newFrames);
  }
  tracePop(working, newFrames, history);
  setTimeline(newFrames);
}

function reset() {
  stopPlayback();
  frames = [];
  frameIndex = 0;
  heap = [];
  poppedValues = [];
  highlighted = new Set();
  input.setAttribute('aria-invalid', 'false');
  drawHeap();
  updatePlaybackControls();
  setMessage('已清空最大堆；可以建立數列或插入一個數字。');
}

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `message${kind ? ` ${kind}` : ''}`;
}

buildButton.addEventListener('click', buildHeap);
addButton.addEventListener('click', addNumber);
newNumberInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addNumber();
});
popButton.addEventListener('click', removeMax);
previousButton.addEventListener('click', () => showFrame(frameIndex - 1));
nextButton.addEventListener('click', () => showFrame(frameIndex + 1));
playButton.addEventListener('click', () => {
  if (playTimer) {
    stopPlayback();
    return;
  }
  if (frameIndex >= frames.length - 1) return;
  previousButton.disabled = true;
  nextButton.disabled = true;
  playTimer = window.setInterval(playNext, PLAY_INTERVAL);
  updatePlaybackControls();
});
resetButton.addEventListener('click', reset);
exampleButton.addEventListener('click', () => {
  input.value = '48, 25, 72, 12, 36, 60, 90';
  buildHeap();
});
input.addEventListener('input', () => input.setAttribute('aria-invalid', 'false'));
window.addEventListener('resize', drawHeap);

drawHeap();
updatePlaybackControls();
