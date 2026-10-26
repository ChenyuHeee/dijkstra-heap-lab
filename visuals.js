(() => {
  "use strict";

  const DATA = window.DECK_DATA;
  const DEMO = window.DECK_DEMO;
  const COLORS = {
    bin: "#91aefb", four: "#f3c969", left: "#b9a2ee", skew: "#f39b82",
    fib: "#df8bc8", binom: "#aeb9b3", radix: "#65deb2",
  };
  const LABELS = {
    bin: "二叉堆 bin", four: "4-ary 堆 four", left: "左偏堆 left", skew: "斜堆 skew",
    fib: "Fibonacci fib", binom: "二项堆 binom", radix: "radix heap",
  };
  const SHORT_LABELS = {
    bin: "bin", four: "four", left: "left", skew: "skew", fib: "fib", binom: "binom", radix: "radix",
  };
  const HINTS = {
    bin: "连续数组 · log₂n", four: "连续数组 · log₄n", left: "meld · npl 维护",
    skew: "meld · 无条件交换", fib: "cut · consolidate", binom: "根链表 · 同度链接",
    radix: "33 桶 · 单调整数键",
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const formatInt = value => Math.round(value).toLocaleString("en-US");
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const formatTime = ms => ms >= 1000
    ? { value: (ms / 1000).toFixed(3), unit: "s" }
    : { value: ms.toFixed(1), unit: "ms" };
  const rgba = (hex, alpha) => {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${value >> 16},${value >> 8 & 255},${value & 255},${alpha})`;
  };

  class StepAnimation {
    constructor(count, duration, onStep) {
      this.count = count;
      this.duration = duration;
      this.onStep = onStep;
      this.index = 0;
      this.elapsed = 0;
      this.playing = false;
      this.onStep(0);
    }
    play() {
      if (this.index >= this.count - 1) this.index = 0;
      this.playing = true;
      this.elapsed = 0;
      this.onStep(this.index);
    }
    pause() { this.playing = false; }
    toggle() { this.playing ? this.pause() : this.play(); }
    reset() {
      this.index = 0;
      this.elapsed = 0;
      this.playing = false;
      this.onStep(0);
    }
    next() {
      this.playing = false;
      this.index = Math.min(this.index + 1, this.count - 1);
      this.elapsed = 0;
      this.onStep(this.index);
    }
    tick(dt) {
      if (!this.playing) return;
      this.elapsed += dt;
      if (this.elapsed < this.duration) return;
      const advances = Math.floor(this.elapsed / this.duration);
      this.elapsed %= this.duration;
      this.index = Math.min(this.index + advances, this.count - 1);
      this.onStep(this.index);
      if (this.index >= this.count - 1) this.playing = false;
    }
  }

  class MapView {
    constructor(canvas, heap = "four", options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.base = document.createElement("canvas");
      this.options = options;
      this.padding = { top: 24, right: 24, bottom: 24, left: 24, ...options.padding };
      this.points = new Float64Array(DEMO.n * 2);
      this.settled = new Uint8Array(DEMO.n);
      this.step = 0;
      this.pathProgress = 0;
      this.width = 0;
      this.height = 0;
      this.setHeap(heap);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement);
      this.resize();
    }
    setHeap(heap) {
      this.heap = heap;
      this.trace = DEMO.traces[heap];
      this.color = COLORS[heap];
      this.step = 0;
      this.pathProgress = 0;
      this.settled.fill(0);
    }
    setStep(step, pathProgress = 0) {
      step = clamp(Math.floor(step), 0, this.trace.pops);
      if (step < this.step) {
        this.settled.fill(0);
        this.step = 0;
      }
      for (let i = this.step + 1; i <= step; i++) this.settled[this.trace.order[i - 1]] = 1;
      this.step = step;
      this.pathProgress = clamp(pathProgress, 0, 1);
      this.render();
    }
    resize() {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!width || !height || (width === this.width && height === this.height && dpr === this.dpr)) return;
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * this.dpr);
      this.canvas.height = Math.round(height * this.dpr);
      this.base.width = this.canvas.width;
      this.base.height = this.canvas.height;
      const p = this.padding;
      let meanY = 0;
      for (let i = 0; i < DEMO.n; i++) meanY += DEMO.xy[i * 2 + 1];
      meanY /= DEMO.n;
      const cos = Math.cos(meanY / 1e6 * Math.PI / 180);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < DEMO.n; i++) {
        const x = DEMO.xy[i * 2] * cos;
        const y = DEMO.xy[i * 2 + 1];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      const scale = Math.min((width - p.left - p.right) / (maxX - minX),
                             (height - p.top - p.bottom) / (maxY - minY));
      const offsetX = p.left + (width - p.left - p.right - (maxX - minX) * scale) / 2;
      const offsetY = p.top + (height - p.top - p.bottom - (maxY - minY) * scale) / 2;
      for (let i = 0; i < DEMO.n; i++) {
        this.points[i * 2] = offsetX + (DEMO.xy[i * 2] * cos - minX) * scale;
        this.points[i * 2 + 1] = offsetY + (maxY - DEMO.xy[i * 2 + 1]) * scale;
      }
      const ctx = this.base.getContext("2d");
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(144, 178, 158, .24)";
      ctx.lineWidth = .72;
      ctx.beginPath();
      for (const [u, v] of DEMO.edges) {
        ctx.moveTo(this.points[u * 2], this.points[u * 2 + 1]);
        ctx.lineTo(this.points[v * 2], this.points[v * 2 + 1]);
      }
      ctx.stroke();
      this.render();
    }
    pathPoints(progress) {
      const path = this.trace.path;
      const lengths = [];
      let total = 0;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const length = Math.hypot(this.points[b * 2] - this.points[a * 2],
                                  this.points[b * 2 + 1] - this.points[a * 2 + 1]);
        lengths.push(length);
        total += length;
      }
      let remaining = total * progress;
      const points = [[this.points[path[0] * 2], this.points[path[0] * 2 + 1]]];
      for (let i = 0; i < lengths.length && remaining > 0; i++) {
        const a = path[i], b = path[i + 1];
        if (remaining >= lengths[i]) {
          points.push([this.points[b * 2], this.points[b * 2 + 1]]);
          remaining -= lengths[i];
        } else {
          const ratio = remaining / lengths[i];
          points.push([
            this.points[a * 2] + (this.points[b * 2] - this.points[a * 2]) * ratio,
            this.points[a * 2 + 1] + (this.points[b * 2 + 1] - this.points[a * 2 + 1]) * ratio,
          ]);
          remaining = 0;
        }
      }
      return points;
    }
    strokePath(points, color, width, glow = false) {
      if (points.length < 2) return;
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = glow ? color : "transparent";
      ctx.shadowBlur = glow ? 12 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    render() {
      if (!this.width || !this.height) return;
      const ctx = this.ctx;
      const w = this.width, h = this.height;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(this.base, 0, 0, this.base.width, this.base.height, 0, 0, w, h);

      ctx.fillStyle = rgba(this.color, this.options.subtle ? .35 : .55);
      ctx.beginPath();
      for (let node = 0; node < DEMO.n; node++) {
        if (!this.settled[node]) continue;
        const x = this.points[node * 2], y = this.points[node * 2 + 1];
        ctx.moveTo(x + 2, y);
        ctx.arc(x, y, this.options.subtle ? 1.6 : 2.1, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.strokeStyle = "rgba(238, 244, 235, .88)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let node = 0; node < DEMO.n; node++) {
        const seen = this.trace.seenAt[node];
        if (seen < 0 || seen > this.step || this.settled[node]) continue;
        const x = this.points[node * 2], y = this.points[node * 2 + 1];
        ctx.moveTo(x + 3.2, y);
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      }
      ctx.stroke();

      if (this.step > 0 && this.step < this.trace.pops) {
        const current = this.trace.order[this.step - 1];
        const x = this.points[current * 2], y = this.points[current * 2 + 1];
        const pulse = this.options.playing ? Math.sin(performance.now() / 170) * 1.5 : 0;
        ctx.beginPath();
        ctx.arc(x, y, 8 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.7;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }

      if (this.pathProgress > 0) {
        const points = this.pathPoints(this.pathProgress);
        this.strokePath(points, "rgba(4, 11, 9, .88)", 8);
        this.strokePath(points, "#d8f58a", 3.8, true);
      }

      for (const [node, label, color] of [[DEMO.source, "S", "#65deb2"], [DEMO.target, "T", "#d8f58a"]]) {
        const x = this.points[node * 2], y = this.points[node * 2 + 1];
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#eef4eb";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fillStyle = "#0a1712";
        ctx.font = "700 10px SFMono-Regular, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y + .5);
      }
    }
  }

  class ArrayHeap {
    constructor(container, arity, color) {
      this.container = container;
      this.arity = arity;
      this.color = color;
      this.initial = [3, 8, 7, 12, 14, 9, 10, 20, 17];
      this.tokens = [...this.initial, 4].map(key => ({ id: key, key }));
      this.edges = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.edges.setAttribute("class", "heap-edges");
      container.append(this.edges);
      this.elements = this.tokens.map(token => {
        const element = document.createElement("div");
        element.className = "heap-token";
        element.textContent = token.key;
        element.style.setProperty("--token-color", color);
        container.append(element);
        return element;
      });
      this.states = this.makeStates();
      this.stateIndex = 0;
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(container);
    }
    makeStates() {
      const withNew = [...this.initial, 4];
      const swap = (array, a, b) => {
        const result = [...array];
        [result[a], result[b]] = [result[b], result[a]];
        return result;
      };
      if (this.arity === 2) {
        const first = swap(withNew, 9, 4);
        const second = swap(first, 4, 1);
        return [
          { heap: this.initial, active: [], label: "初始：两种堆都满足堆序" },
          { heap: withNew, active: [9], label: "插入 4：先放到数组末尾" },
          { heap: first, active: [9, 4], label: "二叉堆：4 < 14，第 1 次上滤" },
          { heap: second, active: [4, 1], label: "二叉堆：4 < 8，第 2 次上滤" },
          { heap: second, active: [1], label: "二叉堆：2 次交换，恢复堆序" },
        ];
      }
      const first = swap(withNew, 9, 2);
      return [
        { heap: this.initial, active: [], label: "初始：两种堆都满足堆序" },
        { heap: withNew, active: [9], label: "插入 4：先放到数组末尾" },
        { heap: first, active: [9, 2], label: "4-ary：4 < 7，第 1 次上滤" },
        { heap: first, active: [2], label: "4-ary：1 次交换，恢复堆序" },
        { heap: first, active: [2], label: "4-ary：更浅的上滤路径" },
      ];
    }
    positions(heap) {
      const w = this.container.clientWidth || 430;
      const h = this.container.clientHeight || 340;
      const positions = [];
      if (this.arity === 2) {
        for (let i = 0; i < heap.length; i++) {
          const level = Math.floor(Math.log2(i + 1));
          const first = 2 ** level - 1;
          const index = i - first;
          positions[i] = [w * (index + .5) / 2 ** level, 42 + level * (h - 94) / 3];
        }
      } else {
        for (let i = 0; i < heap.length; i++) {
          const level = Math.floor(Math.log(i * 3 + 1) / Math.log(4));
          const y = 45 + level * (h - 110) / 2;
          if (i === 0) positions[i] = [w / 2, y];
          else if (i <= 4) positions[i] = [w * i / 5, y];
          else {
            const parent = Math.floor((i - 1) / 4);
            const offset = (i - 1) % 4;
            positions[i] = [positions[parent][0] + (offset - 1.5) * Math.min(39, w / 12), y];
          }
        }
      }
      return positions;
    }
    setStep(index) {
      this.stateIndex = clamp(index, 0, this.states.length - 1);
      this.render();
    }
    render() {
      const state = this.states[this.stateIndex];
      const positions = this.positions(state.heap);
      this.edges.setAttribute("viewBox", `0 0 ${this.container.clientWidth || 430} ${this.container.clientHeight || 340}`);
      const lines = [];
      for (let i = 1; i < state.heap.length; i++) {
        const parent = Math.floor((i - 1) / this.arity);
        lines.push(`<line x1="${positions[parent][0]}" y1="${positions[parent][1]}" x2="${positions[i][0]}" y2="${positions[i][1]}"/>`);
      }
      this.edges.innerHTML = lines.join("");
      const activeTokens = new Set(state.active.map(index => state.heap[index]));
      for (const token of this.tokens) {
        const index = state.heap.indexOf(token.id);
        const element = this.elements[this.tokens.indexOf(token)];
        if (index < 0) {
          element.style.opacity = "0";
          element.style.transform = `translate(${this.container.clientWidth / 2}px, ${this.container.clientHeight - 20}px)`;
          continue;
        }
        element.style.opacity = "1";
        element.style.transform = `translate(${positions[index][0]}px, ${positions[index][1]}px)`;
        element.classList.toggle("is-active", activeTokens.has(token.id));
      }
    }
  }

  class FibViz {
    constructor(container) {
      this.container = container;
      const tree = (key, children = []) => ({ key, children });
      this.states = [
        { roots: [tree(3), tree(8, [tree(14)]), tree(12), tree(20)], min: 3, active: [14],
          phase: "初始：14 是 8 的孩子；根链表保存 4 棵树" },
        { roots: [tree(3), tree(8), tree(12), tree(20), tree(5)], min: 5, active: [5], cut: [8, 5],
          phase: "decrease 14 → 5：切到根链表，min 更新为 5" },
        { roots: [tree(3), tree(8), tree(12), tree(20)], min: 3, active: [3, 12, 8, 20],
          phase: "弹出 5；consolidate 开始：4 个根的度数都是 0" },
        { roots: [tree(3, [tree(12)]), tree(8, [tree(20)])], min: 3, active: [3, 8],
          phase: "同度链接：12 并入 3，20 并入 8；得到两棵度 1 树" },
        { roots: [tree(3, [tree(12), tree(8, [tree(20)])])], min: 3, active: [3],
          phase: "再次链接同度树：只剩度 2 的根 3，consolidate 完成" },
      ];
      this.index = 0;
    }
    setStep(index) {
      this.index = clamp(index, 0, this.states.length - 1);
      this.render();
    }
    render() {
      const state = this.states[this.index];
      const w = Math.max(this.container.clientWidth - 24, 480);
      const h = Math.max(this.container.clientHeight - 10, 320);
      const rootY = 70, childY = 175, grandY = 275;
      const nodes = [], links = [];
      const positions = new Map();
      state.roots.forEach((root, rootIndex) => {
        const x = w * (rootIndex + .5) / state.roots.length;
        positions.set(root, [x, rootY]);
        nodes.push({ node: root, x, y: rootY, root: true });
        root.children.forEach((child, childIndex) => {
          const cx = x + (childIndex - (root.children.length - 1) / 2) * 64;
          positions.set(child, [cx, childY]);
          nodes.push({ node: child, x: cx, y: childY, root: false });
          links.push([x, rootY, cx, childY, false]);
          child.children.forEach(grand => {
            positions.set(grand, [cx, grandY]);
            nodes.push({ node: grand, x: cx, y: grandY, root: false });
            links.push([cx, childY, cx, grandY, false]);
          });
        });
      });
      const rootLine = state.roots.length > 1
        ? `<path class="fib-link" stroke-dasharray="3 5" d="M${w / state.roots.length / 2} ${rootY}H${w - w / state.roots.length / 2}"/>` : "";
      let cut = "";
      if (state.cut) {
        const parent = nodes.find(item => item.node.key === state.cut[0]);
        const child = nodes.find(item => item.node.key === state.cut[1]);
        if (parent && child) cut = `<path class="fib-link is-cut" d="M${parent.x} ${parent.y}Q${(parent.x + child.x) / 2} ${(parent.y + child.y) / 2 - 40} ${child.x} ${child.y}"/>`;
      }
      const body = nodes.map(({ node, x, y, root }) => {
        const classes = ["fib-node", state.active.includes(node.key) ? "is-active" : "", node.key === state.min ? "is-min" : ""].join(" ");
        return `<g class="${classes}"><circle cx="${x}" cy="${y}" r="${root ? 22 : 19}"/><text x="${x}" y="${y}">${node.key}</text></g>`;
      }).join("");
      const linkBody = links.map(([x1, y1, x2, y2]) => `<path class="fib-link" d="M${x1} ${y1}L${x2} ${y2}"/>`).join("");
      this.container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Fibonacci 堆剪切与合并机制示意"><g class="fib-group"><text class="fib-caption" x="12" y="23">ROOT LIST · ${state.roots.length} TREE${state.roots.length > 1 ? "S" : ""}</text>${rootLine}${linkBody}${cut}${body}<text class="fib-caption" x="12" y="${h - 10}">金圈 = min · 粉色 = 当前操作</text></g></svg>`;
    }
  }

  class RadixViz {
    constructor(container, lastElement, labelElement) {
      this.container = container;
      this.lastElement = lastElement;
      this.labelElement = labelElement;
      this.states = [
        { buckets: { 0: [10], 3: [12, 14, 15], 5: [24] }, popped: [], last: 10, activeBucket: 3, activeKey: null,
          label: "桶 0 弹出后为空；寻找最低非空桶：桶 3" },
        { buckets: { 3: [14, 15], 5: [24] }, popped: [10, 12], last: 12, activeBucket: 3, activeKey: 12,
          label: "桶 3 的最小键是 12：弹出，并更新 last = 12" },
        { buckets: { 2: [14], 3: [15], 5: [24] }, popped: [10, 12], last: 12, activeBucket: 2, activeKey: 14,
          label: "重分桶：14 XOR 12 = 2 → 桶 2；15 仍在桶 3" },
        { buckets: { 2: [14], 3: [15], 5: [24] }, popped: [10, 12], last: 12, activeBucket: null, activeKey: null,
          label: "完成。只处理最低非空桶；下一个最小键是 14" },
      ];
      this.index = 0;
      container.innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="radix-bucket" data-bucket="${i}"><span>B${i}</span><small>${i === 0 ? "k = last" : `bit ${i - 1}`}</small></div>`).join("") + '<span class="settled-caption">已弹出</span>';
      this.tokens = new Map();
      for (const key of [10, 12, 14, 15, 24]) {
        const element = document.createElement("div");
        element.className = "radix-token";
        element.textContent = key;
        container.append(element);
        this.tokens.set(key, element);
      }
      this.bucketElements = [...container.querySelectorAll(".radix-bucket")];
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(container);
    }
    setStep(index) {
      this.index = clamp(index, 0, this.states.length - 1);
      this.render();
    }
    render() {
      const state = this.states[this.index];
      const w = this.container.clientWidth || 900;
      const h = this.container.clientHeight || 290;
      const gap = 11;
      const column = (w - gap * 5) / 6;
      const positions = new Map();
      for (const [bucket, keys] of Object.entries(state.buckets)) {
        keys.forEach((key, row) => {
          positions.set(key, [Number(bucket) * (column + gap) + (column - 54) / 2, 58 + row * 49]);
        });
      }
      state.popped.forEach((key, index) => positions.set(key, [85 + index * 64, h - 43]));
      for (const [key, element] of this.tokens) {
        const [x, y] = positions.get(key);
        element.style.transform = `translate(${x}px, ${y}px)`;
        element.classList.toggle("is-active", key === state.activeKey);
        element.classList.toggle("is-settled", state.popped.includes(key));
      }
      this.bucketElements.forEach((element, index) => element.classList.toggle("is-active", index === state.activeBucket));
      this.lastElement.textContent = state.last;
      this.labelElement.textContent = state.label;
    }
  }

  function compactDistance(value) {
    if (value >= 100000) return `${Math.round(value / 1000)}k`;
    if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
  }

  class HeapStateView {
    constructor(container, heap, titleElement, statsElement, stepElement) {
      this.container = container;
      this.titleElement = titleElement;
      this.statsElement = statsElement;
      this.stepElement = stepElement;
      this.snapshotIndex = -1;
      this.previousIds = null;
      this.setHeap(heap);
    }
    setHeap(heap) {
      this.heap = heap;
      this.trace = DEMO.traces[heap];
      this.color = COLORS[heap];
      this.snapshotIndex = -1;
      this.previousIds = null;
      this.titleElement.textContent = heap === "radix" ? "radix · 实际桶结构" : `${LABELS[heap]} · 实际堆结构`;
      this.setStep(0);
    }
    setStep(step) {
      const snapshots = this.trace.snapshots;
      let low = 0, high = snapshots.length - 1, index = 0;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (snapshots[middle].step <= step) {
          index = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      const snapshot = snapshots[index];
      this.stepElement.textContent = step === 0 ? "初始快照 · 源点入堆"
        : snapshot.step === step ? `pop ${step} 后的真实快照`
        : `当前 pop ${step} · 快照 ${snapshot.step}`;
      if (index === this.snapshotIndex) return;
      this.snapshotIndex = index;
      this.render(snapshot);
    }
    render(snapshot) {
      if (this.heap === "radix") this.renderBuckets(snapshot);
      else this.renderTree(snapshot);
      this.previousIds = new Set(snapshot.nodes.map(node => node[0]));
    }
    renderBuckets(snapshot) {
      const buckets = Array.from({ length: 33 }, () => []);
      for (const [id, key, bucket] of snapshot.nodes) buckets[bucket].push([id, key]);
      const occupied = buckets.map((items, bucket) => ({ items, bucket })).filter(item => item.items.length);
      const w = 900, h = 460;
      const columns = 3;
      const cardWidth = (w - 50) / columns;
      const cards = occupied.map(({ items, bucket }, index) => {
        const x = 20 + (index % columns) * cardWidth;
        const y = 22 + Math.floor(index / columns) * 125;
        const keys = items.slice(0, 8).map(([id, key], itemIndex) => {
          const chipX = x + 12 + (itemIndex % 4) * 58;
          const chipY = y + 43 + Math.floor(itemIndex / 4) * 28;
          return `<g class="heap-state-node"><title>顶点 ${id} · 键 ${key}</title><rect x="${chipX}" y="${chipY}" width="51" height="22" rx="4" fill="${rgba(this.color, .14)}" stroke="${rgba(this.color, .45)}"/><text x="${chipX + 25.5}" y="${chipY + 11}" text-anchor="middle" dominant-baseline="central" fill="#eef4eb" font-family="SFMono-Regular,Consolas,monospace" font-size="11">${compactDistance(key)}</text></g>`;
        }).join("");
        return `<g><rect x="${x}" y="${y}" width="${cardWidth - 12}" height="108" rx="8" fill="${rgba(this.color, .045)}" stroke="${rgba(this.color, .25)}"/><text x="${x + 12}" y="${y + 24}" fill="${this.color}" font-family="SFMono-Regular,Consolas,monospace" font-size="14" font-weight="600">B${bucket}</text><text x="${x + cardWidth - 24}" y="${y + 24}" text-anchor="end" fill="#6f857b" font-family="SFMono-Regular,Consolas,monospace" font-size="10">${bucket === 0 ? "k = last" : `bit ${bucket - 1}`} · ${items.length}</text>${keys}${items.length > 8 ? `<text x="${x + 12}" y="${y + 98}" fill="#9eb1a7" font-size="11">+${items.length - 8}</text>` : ""}</g>`;
      }).join("");
      const empty = occupied.length ? "" : `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#6f857b" font-size="18">堆为空 · 查询结束</text>`;
      this.container.innerHTML = `<svg class="heap-state-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="radix 实际桶状态">${cards}${empty}</svg>`;
      this.statsElement.textContent = `队列 ${snapshot.nodes.length} · 非空桶 ${occupied.length} · last ${snapshot.last}`;
    }
    renderTree(snapshot) {
      const allNodes = snapshot.nodes.map(([id, key, parent]) => ({ id, key, parent, children: [], x: 0, depth: 0 }));
      const byId = new Map(allNodes.map(node => [node.id, node]));
      for (const node of allNodes) {
        if (node.parent >= 0 && byId.has(node.parent)) byId.get(node.parent).children.push(node);
      }
      const roots = snapshot.roots.map(id => byId.get(id)).filter(Boolean);
      let nodes = allNodes;
      let collapsed = 0;
      if (allNodes.length > 64) {
        const visible = new Set();
        const queue = [...roots];
        nodes = [];
        while (queue.length && nodes.length < 64) {
          const node = queue.shift();
          if (visible.has(node.id)) continue;
          visible.add(node.id);
          nodes.push(node);
          queue.push(...node.children);
        }
        collapsed = allNodes.length - nodes.length;
        for (const node of nodes) node.children = node.children.filter(child => visible.has(child.id));
      }
      let cursor = 0;
      const place = (node, depth) => {
        node.depth = depth;
        if (!node.children.length) {
          node.x = cursor++;
          return;
        }
        for (const child of node.children) place(child, depth + 1);
        node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
      };
      for (const root of roots) place(root, 0);
      const w = 900, h = 460, padX = 50, padY = 38;
      const maxX = Math.max(1, ...nodes.map(node => node.x));
      const maxDepth = Math.max(1, ...nodes.map(node => node.depth));
      const point = node => nodes.length === 1 ? [w / 2, h / 2]
        : [padX + node.x / maxX * (w - padX * 2), padY + node.depth / maxDepth * (h - padY * 2)];
      const rootIds = new Set(snapshot.roots);
      const radius = nodes.length <= 10 ? 20 : nodes.length <= 26 ? 16 : 12;
      const fontSize = nodes.length <= 10 ? 14 : nodes.length <= 26 ? 12 : 10;
      const visibleIds = new Set(nodes.map(node => node.id));
      const edges = nodes.filter(node => visibleIds.has(node.parent)).map(node => {
        const parent = byId.get(node.parent);
        const [x1, y1] = point(parent), [x2, y2] = point(node);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${rgba(this.color, .32)}" stroke-width="1.4"/>`;
      }).join("");
      const body = nodes.map(node => {
        const [x, y] = point(node);
        const isRoot = rootIds.has(node.id);
        const isNew = this.previousIds && !this.previousIds.has(node.id);
        const fill = isNew ? this.color : "#152821";
        const textColor = isNew ? "#0a1712" : "#eef4eb";
        return `<g class="heap-state-node"><title>顶点 ${node.id} · 键 ${node.key}${isRoot ? " · 根" : ` · 父节点 ${node.parent}`}</title><circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${isRoot ? "#d8f58a" : this.color}" stroke-width="${isRoot ? 3 : 1.6}"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="SFMono-Regular,Consolas,monospace" font-size="${fontSize}">${compactDistance(node.key)}</text></g>`;
      }).join("");
      const empty = nodes.length ? "" : `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#6f857b" font-size="18">堆为空 · 查询结束</text>`;
      const note = collapsed ? `<text x="${w - 22}" y="${h - 12}" text-anchor="end" fill="#6f857b" font-size="12">另有 ${collapsed} 个节点未展开</text>` : "";
      this.container.innerHTML = `<svg class="heap-state-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${LABELS[this.heap]} 实际堆结构">${edges}${body}${empty}${note}</svg>`;
      this.statsElement.textContent = `队列 ${snapshot.nodes.length} · 根 ${snapshot.roots.length} · 显示 ${nodes.length}`;
    }
  }

  class TreeOperationViz {
    constructor(container, states, color, options = {}) {
      this.container = container;
      this.states = states;
      this.options = options;
      this.index = 0;
      this.edges = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.edges.setAttribute("class", "tree-op-edges");
      container.append(this.edges);
      this.keys = [...new Set(states.flatMap(state => Object.keys(state.positions).map(Number)))];
      this.elements = new Map();
      for (const key of this.keys) {
        const element = document.createElement("div");
        element.className = "tree-op-node";
        element.style.setProperty("--tree-color", color);
        element.innerHTML = `<strong>${key}</strong>${options.npl ? "<small>npl 0</small>" : ""}<i></i>`;
        container.append(element);
        this.elements.set(key, element);
      }
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(container);
    }
    setStep(index) {
      this.index = clamp(index, 0, this.states.length - 1);
      this.render();
    }
    render() {
      const state = this.states[this.index];
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 400;
      const point = key => {
        const position = state.positions[key];
        return [position[0] / 1000 * w, position[1] / 400 * h];
      };
      this.edges.setAttribute("viewBox", `0 0 ${w} ${h}`);
      this.edges.innerHTML = state.links.map(([a, b]) => {
        const [x1, y1] = point(a), [x2, y2] = point(b);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }).join("");
      for (const [key, element] of this.elements) {
        const position = state.positions[key];
        element.style.opacity = position ? "1" : "0";
        if (!position) continue;
        const [x, y] = point(key);
        element.style.transform = `translate(${x}px, ${y}px)`;
        element.classList.toggle("is-active", state.active.includes(key));
        element.querySelector("i").textContent = state.degrees && state.degrees[key] || "";
      }
    }
  }

  class MeldViz extends TreeOperationViz {
    constructor(container, mode, color) {
      const initial = { 3: [330, 75], 6: [230, 190], 8: [430, 190], 5: [770, 75] };
      const linked = { 3: [330, 75], 6: [230, 190], 5: [430, 190], 8: [360, 295] };
      const skewed = { 3: [330, 75], 5: [230, 190], 6: [430, 190], 8: [160, 295] };
      const leftist = mode === "left";
      const states = [
        { positions: initial, links: [[3, 6], [3, 8]], active: [3, 5], label: "meld(A, B)：从两棵堆的根 3 与 5 开始" },
        { positions: initial, links: [[3, 6], [3, 8]], active: [3, 8, 5], label: "3 < 5，沿右脊继续 meld(8, 5)" },
        { positions: linked, links: [[3, 6], [3, 5], [5, 8]], active: [5, 8], label: "5 < 8；链接后交换 5 的孩子，使 8 到左侧" },
        leftist
          ? { positions: linked, links: [[3, 6], [3, 5], [5, 8]], active: [3, 6, 5], label: "左偏：npl(6) = npl(5) = 0，根 3 无需交换" }
          : { positions: skewed, links: [[3, 5], [3, 6], [5, 8]], active: [3, 5, 6], label: "斜堆：根 3 无条件交换左右孩子" },
        leftist
          ? { positions: linked, links: [[3, 6], [3, 5], [5, 8]], active: [], label: "最终左偏堆：每个节点都满足 npl(left) ≥ npl(right)" }
          : { positions: skewed, links: [[3, 5], [3, 6], [5, 8]], active: [], label: "最终斜堆：不维护 npl，交换成本在 meld 中摊还" },
      ];
      super(container, states, color, { npl: leftist });
    }
  }

  class BinomialViz extends TreeOperationViz {
    constructor(container, color) {
      const finalPositions = { 3: [520, 65], 8: [650, 205], 5: [390, 205], 12: [390, 315] };
      const finalLinks = [[3, 8], [3, 5], [5, 12]];
      const states = [
        { positions: { 3: [220, 90], 8: [420, 90], 5: [700, 80], 12: [700, 230] },
          links: [[5, 12]], active: [3, 8], degrees: { 3: "B0", 8: "B0", 5: "B1" },
          label: "两个 B0 与一个 B1：先合并度数相同的树" },
        { positions: { 3: [340, 80], 8: [340, 220], 5: [700, 80], 12: [700, 230] },
          links: [[3, 8], [5, 12]], active: [3, 8], degrees: { 3: "B1", 5: "B1" },
          label: "两个 B0 链接：8 成为 3 的孩子，得到 B1" },
        { positions: finalPositions, links: finalLinks, active: [3, 5], degrees: { 3: "B2" },
          label: "两个 B1 再链接：5 成为 3 的孩子，得到 B2" },
        { positions: finalPositions, links: finalLinks, active: [], degrees: { 3: "B2" },
          label: "B2 有 2² = 4 个节点；同度链接类似二进制加法进位" },
      ];
      super(container, states, color);
    }
  }

  function scaleChart(container) {
    const w = 1000, h = 330;
    const left = 45, right = 45, baseline = 158;
    const min = Math.log10(DATA.main[0].n) - .06;
    const max = Math.log10(DATA.main.at(-1).n) + .06;
    const x = n => left + (w - left - right) * (Math.log10(n) - min) / (max - min);
    const compact = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : `${Math.round(n / 1e3)}K`;
    const grid = [1e6, 1e7].map(value => `<line class="chart-grid" x1="${x(value)}" y1="48" x2="${x(value)}" y2="235"/><text class="chart-axis" x="${x(value)}" y="250" text-anchor="middle">${value === 1e6 ? "1M" : "10M"}</text>`).join("");
    const points = DATA.main.map((item, index) => {
      const px = x(item.n);
      const top = index % 2 ? 100 : 63;
      const labelY = index % 2 ? 282 : 303;
      return `<g class="chart-point" tabindex="0"><title>${item.graph} · ${formatInt(item.n)} 节点 · ${formatInt(item.m)} 弧</title><line x1="${px}" y1="${top + 14}" x2="${px}" y2="${baseline - 9}" stroke="rgba(101,222,178,.28)"/><text class="chart-axis" x="${px}" y="${top}" text-anchor="middle">${compact(item.n)}</text><circle cx="${px}" cy="${baseline}" r="${index === DATA.main.length - 1 ? 10 : 7}" fill="${index === DATA.main.length - 1 ? "#d8f58a" : "#65deb2"}" stroke="#0d1b16" stroke-width="3"/><text x="${px}" y="${labelY}" text-anchor="middle" fill="${index === DATA.main.length - 1 ? "#d8f58a" : "#9eb1a7"}" font-family="SFMono-Regular,Consolas,monospace" font-size="13" font-weight="600">${item.graph}</text></g>`;
    }).join("");
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="12 个路网按节点数排列"><line x1="${left}" y1="${baseline}" x2="${w - right}" y2="${baseline}" stroke="rgba(190,218,201,.18)"/>${grid}${points}<text class="chart-axis-title" x="${left}" y="25">节点数增加约 91×</text><text class="chart-axis" x="${w - right}" y="25" text-anchor="end">NY → USA</text></svg>`;
  }

  function runtimeChart(container, selected) {
    const w = 1000, h = 500;
    const margin = { left: 66, right: 20, top: 20, bottom: 66 };
    const xs = DATA.main.map(item => item.n);
    const ys = DATA.main.flatMap(item => DATA.heaps.map(heap => item.times[heap]));
    const xmin = Math.log10(Math.min(...xs)) - .06, xmax = Math.log10(Math.max(...xs)) + .06;
    const ymin = Math.log10(Math.min(...ys)) - .09, ymax = Math.log10(Math.max(...ys)) + .08;
    const x = value => margin.left + (w - margin.left - margin.right) * (Math.log10(value) - xmin) / (xmax - xmin);
    const y = value => margin.top + (h - margin.top - margin.bottom) * (1 - (Math.log10(value) - ymin) / (ymax - ymin));
    const ticks = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter(value => Math.log10(value) >= ymin && Math.log10(value) <= ymax);
    const grid = ticks.map(value => `<line class="chart-grid" x1="${margin.left}" y1="${y(value)}" x2="${w - margin.right}" y2="${y(value)}"/><text class="chart-axis" x="${margin.left - 11}" y="${y(value) + 4}" text-anchor="end">${formatInt(value)}</text>`).join("");
    const xLabels = DATA.main.map(item => `<text class="chart-axis" x="${x(item.n)}" y="${h - 35}" text-anchor="middle">${item.graph}</text>`).join("");
    const series = selected.map(heap => {
      const points = DATA.main.map(item => [x(item.n), y(item.times[heap])]);
      const d = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(" ");
      const dots = DATA.main.map((item, index) => `<g class="chart-point" tabindex="0"><title>${item.graph} · ${LABELS[heap]} · ${item.times[heap].toFixed(1)} ms · n=${item.nq}</title><circle cx="${points[index][0]}" cy="${points[index][1]}" r="5" fill="${COLORS[heap]}"/></g>`).join("");
      return `<path class="chart-line" pathLength="1" d="${d}" stroke="${COLORS[heap]}"/>${dots}`;
    }).join("");
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="运行时间随图规模变化的双对数图"><title>每查询中位耗时；点击图例筛选数据结构</title>${grid}<line x1="${margin.left}" y1="${h - margin.bottom}" x2="${w - margin.right}" y2="${h - margin.bottom}" stroke="rgba(190,218,201,.25)"/>${xLabels}<text class="chart-axis-title" x="${w / 2}" y="${h - 8}" text-anchor="middle">数据集（横轴按节点数对数定位）</text><text class="chart-axis-title" transform="translate(16 ${h / 2}) rotate(-90)" text-anchor="middle">每查询中位耗时 · ms · log</text>${series}</svg>`;
  }

  function ratioChart(container, selected) {
    const w = 1000, h = 500;
    const margin = { left: 66, right: 20, top: 20, bottom: 66 };
    const xs = DATA.main.map(item => item.n);
    const xmin = Math.log10(Math.min(...xs)) - .06, xmax = Math.log10(Math.max(...xs)) + .06;
    const maxRatio = Math.max(...DATA.main.flatMap(item => selected.map(heap => item.times[heap] / item.times.four)));
    const maxY = Math.max(2.4, Math.ceil(maxRatio * 10) / 10);
    const x = value => margin.left + (w - margin.left - margin.right) * (Math.log10(value) - xmin) / (xmax - xmin);
    const y = value => margin.top + (h - margin.top - margin.bottom) * (1 - value / maxY);
    const ticks = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter(value => value <= maxY);
    const grid = ticks.map(value => `<line class="chart-grid" x1="${margin.left}" y1="${y(value)}" x2="${w - margin.right}" y2="${y(value)}"/><text class="chart-axis" x="${margin.left - 11}" y="${y(value) + 4}" text-anchor="end">${value.toFixed(1)}</text>`).join("");
    const xLabels = DATA.main.map(item => `<text class="chart-axis" x="${x(item.n)}" y="${h - 35}" text-anchor="middle">${item.graph}</text>`).join("");
    const series = selected.map(heap => {
      const points = DATA.main.map(item => [x(item.n), y(item.times[heap] / item.times.four)]);
      const d = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(" ");
      const dots = DATA.main.map((item, index) => {
        const ratio = item.times[heap] / item.times.four;
        return `<g class="chart-point" tabindex="0"><title>${item.graph} · ${LABELS[heap]} / four · ${ratio.toFixed(3)} · ${item.times[heap].toFixed(1)} / ${item.times.four.toFixed(1)} ms</title><circle cx="${points[index][0]}" cy="${points[index][1]}" r="5" fill="${COLORS[heap]}"/></g>`;
      }).join("");
      return `<path class="chart-line" pathLength="1" d="${d}" stroke="${COLORS[heap]}"/>${dots}`;
    }).join("");
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="相对 4-ary 堆的耗时比趋势图"><title>每查询中位耗时比，以 four 为 1.0</title>${grid}<line x1="${margin.left}" y1="${y(1)}" x2="${w - margin.right}" y2="${y(1)}" stroke="rgba(216,245,138,.55)" stroke-dasharray="6 5"/>${xLabels}<text class="chart-axis-title" x="${w / 2}" y="${h - 8}" text-anchor="middle">数据集（横轴按节点数对数定位）</text><text class="chart-axis-title" transform="translate(16 ${h / 2}) rotate(-90)" text-anchor="middle">耗时比 · time / four</text>${series}</svg>`;
  }

  function spreadChart(container) {
    const w = 1000, h = 390;
    const margin = { left: 62, right: 20, top: 22, bottom: 55 };
    const maxY = Math.max(2, Math.ceil(DATA.repeat.spreadMaxPct * 2) / 2);
    const y = value => margin.top + (h - margin.top - margin.bottom) * (1 - value / maxY);
    const ticks = Array.from({ length: maxY * 2 + 1 }, (_, index) => index / 2);
    const grid = ticks.map(value => `<line class="chart-grid" x1="${margin.left}" y1="${y(value)}" x2="${w - margin.right}" y2="${y(value)}"/><text class="chart-axis" x="${margin.left - 10}" y="${y(value) + 4}" text-anchor="end">${value.toFixed(1)}%</text>`).join("");
    const groupWidth = (w - margin.left - margin.right) / DATA.repeat.graphs.length;
    const points = DATA.repeat.graphs.flatMap((graph, graphIndex) => DATA.heaps.map((heap, heapIndex) => {
      const item = graph.heaps[heap];
      const px = margin.left + groupWidth * (graphIndex + .5) + (heapIndex - 3) * 15;
      return `<g class="chart-point" tabindex="0"><title>${graph.graph} · ${heap} · 相对极差 ${item.spreadPct.toFixed(2)}% · ${item.min.toFixed(1)}–${item.max.toFixed(1)} ms</title><line x1="${px}" y1="${y(0)}" x2="${px}" y2="${y(item.spreadPct)}" stroke="${rgba(COLORS[heap], .28)}"/><circle cx="${px}" cy="${y(item.spreadPct)}" r="5" fill="${COLORS[heap]}"/></g>`;
    })).join("");
    const labels = DATA.repeat.graphs.map((graph, index) => `<text class="chart-axis" x="${margin.left + groupWidth * (index + .5)}" y="${h - 25}" text-anchor="middle">${graph.graph}</text>`).join("");
    const median = DATA.repeat.spreadMedianPct;
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="49 个数据集与堆组合的三轮相对极差">${grid}<line x1="${margin.left}" y1="${y(median)}" x2="${w - margin.right}" y2="${y(median)}" stroke="#d8f58a" stroke-dasharray="5 5"/><text x="${w - margin.right - 5}" y="${y(median) - 8}" text-anchor="end" fill="#d8f58a" font-family="SFMono-Regular,Consolas,monospace" font-size="11">中位数 ${median.toFixed(2)}%</text>${points}${labels}<text class="chart-axis-title" transform="translate(16 ${h / 2}) rotate(-90)" text-anchor="middle">相对极差 · %</text></svg>`;
  }

  window.DeckVisuals = {
    COLORS, LABELS, SHORT_LABELS, HINTS, MapView, ArrayHeap, FibViz, RadixViz, HeapStateView,
    MeldViz, BinomialViz, StepAnimation, scaleChart, runtimeChart, ratioChart, spreadChart,
    clamp, formatInt, formatTime, escapeHtml, rgba,
  };
})();
