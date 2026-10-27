(() => {
  "use strict";

  const DATA = window.DECK_DATA;
  const DEMO = window.DECK_DEMO;
  const V = window.DeckVisuals;
  const $ = id => document.getElementById(id);
  const slides = [...document.querySelectorAll(".slide")];
  const appendixStart = slides.findIndex(slide => slide.dataset.appendix === "true");
  const qaIndex = slides.findIndex(slide => slide.dataset.title === "Q & A");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controllers = new Map();
  const speeds = [.5, 1, 2, 4];
  let current = 0;
  let activeController = null;
  let overviewOpen = false;
  let notesOpen = false;
  let stabilityMode = "repeat";
  let runtimeMode = "absolute";

  const SPEAKER_NOTES = {
    cover: `<p><strong>建议 20 秒。</strong>本次汇报按“题目—数据结构—算法—实验—归因—结论”展开。实现 7 种优先队列，在 12 个美国路网上比较操作成本。</p>`,
    assignment: `<p><strong>建议 35 秒。</strong>逐项交代题目要求：Dijkstra、至少两种堆且必须含 Fibonacci、美国路网、至少 1000 对查询，以及运行表、规模图和分析。我们的研究问题是这些实现的墙钟差异来自哪些操作。</p>`,
    "ds-binary": `<p><strong>建议 25–40 秒。</strong>二叉堆是完全二叉树，数组下标直接给父子关系。插入上滤，pop 末元素补根后下滤，decrease 经 pos 定位后上滤。三项都是 O(log n)，它是连续数组路线的基线。</p>`,
    "ds-four": `<p><strong>建议 25–40 秒。</strong>4-ary 把分支数改为 4，树高从 log₂n 变为 log₄n。虽然每层最多比较 4 个孩子，但移动层数更少，连续数组仍有缓存优势。</p>`,
    "ds-left": `<p><strong>建议 25–40 秒。</strong>左偏堆维护 npl(left)≥npl(right)，meld 沿右脊。push 是单节点 meld，pop 合并左右子树，decrease 切断、修复 npl 后重新 meld。指针和 npl 维护是工程成本。</p>`,
    "ds-skew": `<p><strong>建议 25–40 秒。</strong>斜堆与左偏堆使用相似的 meld，但不记录 npl，每次链接后无条件交换孩子。三项操作都是 O(log n) 摊还。对照动画看根 3：左偏不必交换，斜堆必须交换。</p>`,
    "ds-binom": `<p><strong>建议 25–40 秒。</strong>二项堆是按 degree 排列的二项树森林，Bk 有 2^k 个节点。动画展示 B0 链接成 B1，再把两个 B1 链接成 B2。pop 扫描根、反转孩子并 meld，decrease 交换 key/id 上移。</p>`,
    "ds-fib": `<p><strong>建议 25–40 秒。</strong>Fibonacci 延迟整理：push 进根链表，decrease 用 cut 和级联切断，pop 才 consolidate。O(1) 是摊还界，不代表任何一次 decrease 都严格一步完成。</p>`,
    "ds-radix": `<p><strong>建议 25–40 秒。</strong>radix 依赖非负整数键和单调 last，按 k XOR last 的最高有效位分桶。最低非空桶找 min，更新 last 后重分桶。每个 32 位元素最多跨桶 32 次，三项操作摊还 O(1)，但不是通用比较堆。</p>`,
    dijkstra: `<p><strong>建议 40 秒。</strong>现在把数据结构放回 Dijkstra：首次发现顶点 push，更短距离出现时 decrease，弹出最小键确定顶点，目标弹出即停。地图是真实 NY 局部轨迹，性能仍来自完整图。</p><p>右侧同步画实际堆树：圆点是顶点，连线是父子关系；指针堆显示森林，radix 显示真实桶。每 4 次 pop 采样，不是操作次数图。拖动进度可对照地图与内部结构。</p>`,
    compare: `<p><strong>建议 30 秒。</strong>同一源点和目标点，最短距离不变；这个例子里路径也一致。优先队列改变的是操作实现和成本。动画按搜索进度播放，不代表实测速度。</p>`,
    implementation: `<p><strong>建议 40 秒。</strong>这一页来自报告 2.1–2.4，用来补充实现细节：两遍扫描构造 CSR、目标弹出即停、touched-list 做 O(reached) 重置。强调 consolidate 工作数组 A 只分配一次并复用，这是真实的实现修正，不是忽略成本。</p>`,
    fairness: `<p><strong>建议 40 秒。</strong>唯一主动变量是堆。图、CSR、Dijkstra 模板、查询、编译选项、单线程绑核和计时口径全部固定。正确性先做模型、Bellman–Ford、真实路网与 sanitizer 验证。</p>`,
    scale: `<p><strong>建议 40 秒。</strong>12 个数据集从 NY 到 USA。主实验每种堆 8700 对查询：7 个 1000、3 个 500、CTR/USA 各 100。三轮重复、最大图 1000 对、种子和 RSS 是独立补充实验，不混入口径。</p>`,
    runtime: `<p><strong>建议 45 秒。</strong>先给结果：radix 在 12 个图全部最快，four 在比较堆中全部最快，Fibonacci 最慢。NY 三者是 11.2/12.9/26.8 ms，USA 是 1471.0/2024.3/4108.8 ms。</p><p>节点数约增长 91 倍，four 的耗时约增长 157 倍，搜索空间之外还有 log n 与缓存压力。切换到相对 four 比值：radix/four 为 0.73–0.96，fib/four 为 2.0–2.3，差距主要是常数因子。</p>`,
    bars: `<p><strong>建议 35 秒。</strong>USA 主实验 100 对查询中，radix 1.471 秒、four 2.024 秒、Fibonacci 4.109 秒。radix 少 27.3%，Fibonacci 是 four 的 2.03 倍。后面解释这些差距来自哪里。</p>`,
    operations: `<p><strong>建议 45 秒。</strong>时间是操作次数乘单次成本并叠加访存影响的概念组合，不是拟合公式。USA 每查询约 1230 万次 pop，decrease/pop 只有 7.2%；NY 为 14.4%。因此不能只看 decrease 的渐近复杂度。</p>`,
    "four-results": `<p><strong>建议 40 秒。</strong>4-ary 的胜利来自更浅上滤路径和连续数组缓存，而不是更好的渐近界。12 个数据集上相比二叉堆耗时降低 7.0%–11.2%，USA 约 11.2%。</p>`,
    "fib-results": `<p><strong>建议 45 秒。</strong>Fibonacci 的 O(1) decrease 用在不占多数的操作上，每次 pop 却要 consolidate、维护根链表和指针。USA 实测是 four 的 2.03 倍，这就是理论—实践反转。</p>`,
    "radix-results": `<p><strong>建议 40 秒。</strong>radix 不是“更快地比较”，而是利用整数键和单调性绕开逐层比较。最低非空桶找 min 并重分桶，摊还 O(1)，所以 12 个图全部最快；同时必须说明适用边界。</p>`,
    robustness: `<p><strong>建议 50 秒，四个标签只讲结论。</strong>三轮重复极差中位数 0.43%、最大 1.52%。USA 1000 对下 radix/four/fib 为 1474.4/2049.5/4134.8 ms。12 个种子组合排名一致。USA 独立 RSS：four 832 MB、fib 1939 MB、radix 850 MB。</p>`,
    discussion: `<p><strong>建议 45 秒。</strong>这一页来自报告 3.4.4–3.6 和第 4 章：节点与 settle 约增长 91 倍，four 时间约增长 157 倍，说明搜索空间、log n 和缓存压力共同作用。再说明内存、单一机器与查询分布的限制，最后引出减少搜索空间的后续方向。</p>`,
    conclusion: `<p><strong>建议 40 秒。</strong>最终结论按适用条件给出：通用比较堆选 four；整数单调键选 radix；Fibonacci 保留为理论基准。进一步加速应减少搜索空间，而不是只微调堆常数。</p>`,
    qa: `<p>谢谢大家。提问时按 A 查看备份，按 O 返回任意页面。</p>`,
    "full-results": `<p>完整主表包含 12 个数据集和 7 种堆。薄荷绿是整体最快，琥珀色下划线是比较堆最快；单位 ms，查询数在第四列。</p>`,
    verification: `<p>正确性分堆模型、Bellman–Ford、真实路网和 sanitizers 四层；公平性强调同一主循环与编译期展开。</p>`,
    complexity: `<p>复杂度用于回答理论问题。radix、斜堆和 Fibonacci 的相关界限要说明摊还与适用条件。</p>`,
    limits: `<p>主动承认单一机器、随机查询、无 CPU 隔离与锁频。地图使用真实坐标和真实堆轨迹，但局部子图只承担演示职责。</p>`,
    faq: `<p>问答备用：CTR/USA 主表查询数、radix 的公平性、4-ary 的缓存优势、Fibonacci 的常数成本、独立内存测量和后续加速。数字与 results/bench.csv 及补充实验一致。</p>`,
  };

  function setPlayButton(button, playing, label = "播放") {
    if (!button) return;
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", playing ? "#i-pause" : "#i-play");
    const text = button.querySelector("span");
    if (text) text.textContent = playing ? "暂停" : label;
    button.setAttribute("aria-label", playing ? "暂停动画" : label);
  }

  function preparePrefixes() {
    for (const trace of Object.values(DEMO.traces)) {
      trace.pushPrefix = new Uint32Array(trace.pops + 1);
      trace.decreasePrefix = new Uint32Array(trace.pops + 1);
      trace.pushPrefix[0] = 1;
      for (let step = 1; step <= trace.pops; step++) {
        trace.pushPrefix[step] = trace.pushPrefix[step - 1] + trace.pushesAt[step - 1];
        trace.decreasePrefix[step] = trace.decreasePrefix[step - 1] + trace.decreasesAt[step - 1];
      }
    }
  }

  function statsAt(trace, step) {
    return { pops: step, pushes: trace.pushPrefix[step], decreases: trace.decreasePrefix[step] };
  }

  function statMarkup(trace, step, includeDistance = false) {
    const stats = statsAt(trace, step);
    const values = [
      [stats.pops, "pop / settled"],
      [stats.pushes, "push / discovered"],
      [stats.decreases, "decrease-key"],
    ];
    if (includeDistance) values.push([step >= trace.pops ? V.formatInt(trace.distance) : "—", "dist(t)"]);
    return values.map(([value, label]) => `<div><strong>${typeof value === "number" ? V.formatInt(value) : value}</strong><span>${label}</span></div>`).join("");
  }

  class TracePlayer {
    constructor({ map, heap = "four", playButton = null, resetButton = null, timeline = null,
                  speedButton = null, statsElement = null, distanceElement = null,
                  auto = false, loop = false, onUpdate = null, rate = 80 }) {
      this.map = map;
      this.rate = rate;
      this.playButton = playButton;
      this.timeline = timeline;
      this.speedButton = speedButton;
      this.statsElement = statsElement;
      this.distanceElement = distanceElement;
      this.auto = auto;
      this.loop = loop;
      this.onUpdate = onUpdate;
      this.speedIndex = 1;
      this.playhead = 0;
      this.playing = false;
      this.hasPlayed = false;
      this.lastStatsStep = -1;
      if (playButton) playButton.addEventListener("click", () => this.toggle());
      if (resetButton) resetButton.addEventListener("click", () => this.replay());
      if (timeline) timeline.addEventListener("input", () => {
        this.pause();
        this.playhead = Number(timeline.value) / 1000 * this.total();
        this.update(true);
      });
      if (speedButton) speedButton.addEventListener("click", () => {
        this.speedIndex = (this.speedIndex + 1) % speeds.length;
        speedButton.textContent = `${speeds[this.speedIndex]}×`;
      });
      this.setHeap(heap);
    }
    total() { return this.map.trace.pops + 160; }
    setHeap(heap) {
      this.pause();
      this.map.setHeap(heap);
      this.playhead = 0;
      this.lastStatsStep = -1;
      this.update(true);
    }
    play() {
      if (this.playhead >= this.total()) this.playhead = 0;
      this.playing = true;
      this.hasPlayed = true;
      setPlayButton(this.playButton, true);
      this.update(true);
    }
    pause() {
      this.playing = false;
      this.map.options.playing = false;
      setPlayButton(this.playButton, false);
      if (this.map) this.map.render();
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    replay() {
      this.playhead = 0;
      this.play();
    }
    tick(dt) {
      if (!this.playing) return;
      this.playhead += dt / 1000 * this.rate * speeds[this.speedIndex];
      if (this.loop) {
        if (this.playhead >= this.total() + 160) this.playhead = 0;
      } else if (this.playhead >= this.total()) {
        this.playhead = this.total();
        this.playing = false;
        setPlayButton(this.playButton, false, "重播");
      }
      this.update();
    }
    update(force = false) {
      const trace = this.map.trace;
      const head = Math.min(this.playhead, this.total());
      const step = Math.min(Math.floor(head), trace.pops);
      const path = V.clamp((head - trace.pops) / 160, 0, 1);
      this.map.options.playing = this.playing && step < trace.pops;
      this.map.setStep(step, path);
      if (this.timeline) {
        this.timeline.value = Math.round(head / this.total() * 1000);
        this.timeline.style.setProperty("--progress", `${head / this.total() * 100}%`);
      }
      if (force || step !== this.lastStatsStep) {
        if (this.statsElement) this.statsElement.innerHTML = statMarkup(trace, step);
        if (this.distanceElement) this.distanceElement.textContent = step >= trace.pops ? V.formatInt(trace.distance) : "—";
        this.lastStatsStep = step;
      }
      if (this.onUpdate) this.onUpdate({ step, path, playing: this.playing, trace });
    }
    enter() {
      this.map.resize();
      if (reducedMotion.matches && !this.hasPlayed) {
        this.playhead = this.total();
        this.update(true);
      } else if (this.auto && !this.hasPlayed) this.play();
    }
    resize() { this.map.resize(); }
    space() { this.toggle(); }
  }

  class ComparePlayer {
    constructor() {
      this.maps = { A: new V.MapView($("compareAMap"), "four"), B: new V.MapView($("compareBMap"), "radix") };
      this.selects = { A: $("compareA"), B: $("compareB") };
      this.playing = false;
      this.progress = 0;
      this.speedIndex = 1;
      this.hasPlayed = false;
      this.lastSteps = { A: -1, B: -1 };
      for (const side of ["A", "B"]) {
        this.selects[side].addEventListener("change", () => this.changeHeap(side));
      }
      $("comparePlay").addEventListener("click", () => this.toggle());
      $("compareReset").addEventListener("click", () => this.replay());
      $("compareTimeline").addEventListener("input", event => {
        this.pause();
        this.progress = Number(event.target.value) / 1000;
        this.update(true);
      });
      $("compareSpeed").addEventListener("click", event => {
        this.speedIndex = (this.speedIndex + 1) % speeds.length;
        event.currentTarget.textContent = `${speeds[this.speedIndex]}×`;
      });
      this.update(true);
    }
    maxTotal() { return Math.max(...Object.values(this.maps).map(map => map.trace.pops + 160)); }
    changeHeap(side) {
      this.pause();
      const heap = this.selects[side].value;
      this.maps[side].setHeap(heap);
      this.selects[side].closest(".compare-panel").style.setProperty("--heap-color", V.COLORS[heap]);
      this.progress = 0;
      this.lastSteps[side] = -1;
      this.update(true);
    }
    play() {
      if (this.progress >= 1) this.progress = 0;
      this.playing = true;
      this.hasPlayed = true;
      setPlayButton($("comparePlay"), true);
    }
    pause() {
      this.playing = false;
      Object.values(this.maps).forEach(map => { map.options.playing = false; map.render(); });
      setPlayButton($("comparePlay"), false);
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    replay() { this.progress = 0; this.play(); }
    tick(dt) {
      if (!this.playing) return;
      this.progress += dt / 1000 * 80 * speeds[this.speedIndex] / this.maxTotal();
      if (this.progress >= 1) {
        this.progress = 1;
        this.playing = false;
        setPlayButton($("comparePlay"), false, "重播");
      }
      this.update();
    }
    update(force = false) {
      for (const side of ["A", "B"]) {
        const map = this.maps[side];
        const trace = map.trace;
        const head = this.progress * (trace.pops + 160);
        const step = Math.min(Math.floor(head), trace.pops);
        const path = V.clamp((head - trace.pops) / 160, 0, 1);
        map.options.playing = this.playing && step < trace.pops;
        map.setStep(step, path);
        if (force || this.lastSteps[side] !== step) {
          $(`compare${side}Stats`).innerHTML = statMarkup(trace, step, true);
          $(`compare${side}Hint`).textContent = V.HINTS[this.selects[side].value];
          this.lastSteps[side] = step;
        }
      }
      const timeline = $("compareTimeline");
      timeline.value = Math.round(this.progress * 1000);
      timeline.style.setProperty("--progress", `${this.progress * 100}%`);
      const four = DEMO.traces.four;
      $("compareOutcome").innerHTML = `相同距离 <strong>${V.formatInt(four.distance)}</strong> · ${DEMO.samePath ? `相同路径 · ${four.path.length} 个节点` : "等长路径可能不同"}`;
    }
    enter() {
      Object.values(this.maps).forEach(map => map.resize());
      if (reducedMotion.matches && !this.hasPlayed) {
        this.progress = 1;
        this.update(true);
      } else if (!this.hasPlayed && !reducedMotion.matches) this.play();
    }
    resize() { Object.values(this.maps).forEach(map => map.resize()); }
    space() { this.toggle(); }
  }

  class MechanismPlayer {
    constructor({ animation, playButton = null, resetButton = null, nextButton = null,
                  label = "播放机制", auto = false, resize = null }) {
      this.animation = animation;
      this.playButton = playButton;
      this.label = label;
      this.auto = auto;
      this.hasPlayed = false;
      this.resizeCallback = resize;
      if (playButton) playButton.addEventListener("click", () => this.toggle());
      if (resetButton) resetButton.addEventListener("click", () => this.replay());
      if (nextButton) nextButton.addEventListener("click", () => {
        this.animation.next();
        setPlayButton(this.playButton, false, this.label);
      });
    }
    play() { this.animation.play(); this.hasPlayed = true; setPlayButton(this.playButton, true); }
    pause() { this.animation.pause(); setPlayButton(this.playButton, false, this.label); }
    toggle() { this.animation.playing ? this.pause() : this.play(); }
    replay() { this.animation.reset(); this.play(); }
    tick(dt) {
      this.animation.tick(dt);
      if (!this.animation.playing) setPlayButton(this.playButton, false, this.label);
    }
    enter() {
      if (this.resizeCallback) this.resizeCallback();
      if (reducedMotion.matches && !this.hasPlayed) {
        this.animation.index = this.animation.count - 1;
        this.animation.onStep(this.animation.index);
      } else if (this.auto && !this.hasPlayed) this.play();
    }
    resize() { if (this.resizeCallback) this.resizeCallback(); }
    space() { this.toggle(); }
  }

  function heapOptions(selected) {
    return DATA.heaps.map(heap => `<option value="${heap}" ${heap === selected ? "selected" : ""}>${V.LABELS[heap]}</option>`).join("");
  }

  function renderRuntimeChart(selected) {
    if (runtimeMode === "ratio") V.ratioChart($("runtimeChart"), [...selected]);
    else V.runtimeChart($("runtimeChart"), [...selected]);
    $("runtimeLegend").innerHTML = DATA.heaps.map(heap => `<button class="legend-button ${selected.has(heap) ? "is-selected" : ""}" style="--c:${V.COLORS[heap]}" data-heap="${heap}" aria-pressed="${selected.has(heap)}"><i></i>${heap}</button>`).join("");
    $("runtimeAll").textContent = selected.size === DATA.heaps.length ? "只看 4 种代表堆" : "显示全部 7 种";
    $("runtimeMetric").textContent = runtimeMode === "ratio" ? "绝对耗时 →" : "相对 four →";
    $("runtimeMetric").setAttribute("aria-pressed", String(runtimeMode === "ratio"));
  }

  function renderBars(graph) {
    const item = DATA.main.find(row => row.graph === graph);
    const heaps = ["bin", "four", "fib", "radix"];
    const max = Math.max(...heaps.map(heap => item.times[heap]));
    $("barDataset").value = graph;
    $("barNq").textContent = `主实验 · ${V.formatInt(item.nq)} 对查询`;
    $("barSlideTitle").textContent = graph === "USA" ? "在全美图上，差距落到秒" : `${graph}：四种代表堆的查询耗时`;
    $("barChart").innerHTML = heaps.map(heap => {
      const time = V.formatTime(item.times[heap]);
      return `<div class="bar-row" style="--bar-color:${V.COLORS[heap]}"><div class="bar-label"><strong>${V.SHORT_LABELS[heap]}</strong><span>${V.HINTS[heap]}</span></div><div class="bar-track"><div class="bar-fill" style="--bar-width:${item.times[heap] / max * 100}%"></div></div><div class="bar-value">${time.value}<small>${time.unit}</small></div></div>`;
    }).join("");
    const saving = (1 - item.times.radix / item.times.four) * 100;
    $("radixSaving").textContent = `${saving.toFixed(1)}%`;
    $("fibRatio").textContent = `${(item.times.fib / item.times.four).toFixed(2)}×`;
    $("barConclusion").textContent = `${graph} 上，radix 整体最快，four 是比较堆最快；radix / four = ${(item.times.radix / item.times.four).toFixed(2)}。`;
  }

  function renderOperationCounts() {
    const rows = ["NY", "BAY", "COL", "FLA", "USA"].map(graph => {
      const item = DATA.operations.find(row => row.graph === graph);
      const ratio = item.decreases / item.pops * 100;
      return `<tr><td>${graph}</td><td>${V.formatInt(item.pushes)}</td><td>${V.formatInt(item.pops)}</td><td>${V.formatInt(item.decreases)}</td><td>${ratio.toFixed(1)}%</td></tr>`;
    }).join("");
    $("operationCounts").innerHTML = `<table class="count-table"><thead><tr><th>数据集</th><th>push</th><th>pop / settled</th><th>decrease</th><th>dec / pop</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderFullResults() {
    const head = ["数据集", "节点", "有向弧", "查询", ...DATA.heaps];
    const body = DATA.main.map(item => {
      const comparisonBest = ["bin", "four", "left", "skew", "fib", "binom"].reduce((best, heap) => item.times[heap] < item.times[best] ? heap : best, "bin");
      const cells = DATA.heaps.map(heap => {
        const classes = [item.times[heap] === Math.min(...Object.values(item.times)) ? "best" : "", heap === comparisonBest ? "comparison-best" : ""].join(" ");
        return `<td class="${classes}">${item.times[heap].toFixed(1)}</td>`;
      }).join("");
      return `<tr><td>${item.graph}</td><td>${V.formatInt(item.n)}</td><td>${V.formatInt(item.m)}</td><td>${V.formatInt(item.nq)}</td>${cells}</tr>`;
    }).join("");
    $("fullResults").innerHTML = `<table class="full-table"><thead><tr>${head.map((label, index) => `<th class="${index >= 4 ? "table-heap" : ""}" style="--heap-color:${index >= 4 ? V.COLORS[DATA.heaps[index - 4]] : "inherit"}">${label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderComplexity() {
    const rows = [
      ["bin", "比较堆", "O(log n)", "O(log n)", "O((m+n) log n)"],
      ["four", "比较堆", "O(log n)", "O(log n)", "O((m+n) log n)"],
      ["left", "比较堆", "O(log n)", "O(log n)", "O((m+n) log n)"],
      ["skew", "比较堆", "O(log n) 摊还", "O(log n) 摊还", "O((m+n) log n)"],
      ["fib", "比较堆", "O(log n) 摊还", "O(1) 摊还", "O(m + n log n)"],
      ["binom", "比较堆", "O(log n)", "O(log n)", "O((m+n) log n)"],
      ["radix", "单调整数队列", "O(1) 摊还", "O(1) 摊还", "O(m + n log C)"],
    ];
    $("complexityTable").innerHTML = `<table class="full-table"><thead><tr><th>堆</th><th>类别</th><th>extract-min</th><th>decrease-key</th><th>Dijkstra</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => `<td style="${index === 0 ? `color:${V.COLORS[cell]};font-weight:650` : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function supplementBars(items, unit = "time") {
    return items.map(item => {
      const value = unit === "time" ? V.formatTime(item.value) : { value: V.formatInt(item.value), unit: "MB" };
      return `<div class="bar-row" style="--bar-color:${item.color}"><div class="bar-label"><strong>${item.label}</strong><span>${item.sublabel || ""}</span></div><div class="bar-track"><div class="bar-fill" style="--bar-width:${item.value / item.max * 100}%"></div></div><div class="bar-value">${value.value}<small>${value.unit}</small></div></div>`;
    }).join("");
  }

  function renderStability() {
    document.querySelectorAll("[data-stability]").forEach(button => {
      const mode = button.dataset.stability;
      button.hidden = mode !== "repeat" && !DATA[mode].available;
      button.classList.toggle("is-selected", mode === stabilityMode);
      button.setAttribute("aria-pressed", String(mode === stabilityMode));
    });
    if (stabilityMode !== "repeat" && !DATA[stabilityMode].available) stabilityMode = "repeat";
    if (stabilityMode === "repeat") {
      $("stabilityTitle").textContent = "排名稳定，不只靠一次计时";
      $("stabilitySubtitle").textContent = "7 个 1000 对数据集 · 1 轮热身 + 3 轮正式计时。";
      $("stabilityFootnote").textContent = "主结果与补充实验分开呈现，不混合不同查询数和计时轮次。";
      $("stabilityContent").innerHTML = `<div class="stability-layout"><div class="spread-chart-card"><div class="card-heading"><span>49 个组合的相对极差</span><small>(max − min) / median · 越低越稳定</small></div><div id="spreadChart"></div></div><aside class="stability-metrics"><article><span>相对极差中位数</span><strong>${DATA.repeat.spreadMedianPct.toFixed(2)}%</strong><p>7 图 × 7 堆 = 49 个组合</p></article><article><span>最大相对极差</span><strong>${DATA.repeat.spreadMaxPct.toFixed(2)}%</strong><p>三轮正式计时的最大值与最小值</p></article><article><span>最快结构一致</span><strong>${DATA.repeat.consistentGraphs} / ${DATA.repeat.totalGraphs}</strong><p>各数据集三轮选出的最快堆一致</p></article></aside></div>`;
      V.spreadChart($("spreadChart"));
      return;
    }
    if (stabilityMode === "c1000") {
      $("stabilityTitle").textContent = "最大图，也完成 1000 对验证";
      $("stabilitySubtitle").textContent = "CTR / USA · fib、four、radix 三个代表堆 · 每图 1000 对查询。";
      $("stabilityFootnote").textContent = "补充实验单独呈现；其余四种堆在 CTR / USA 上保留主实验 100 对结果。";
      const bars = DATA.c1000.graphs.flatMap(graph => {
        const max = Math.max(...Object.values(graph.heaps).map(item => item.med));
        return ["fib", "four", "radix"].map(heap => ({
          label: `${graph.graph} · ${heap}`, sublabel: `${graph.heaps[heap].nq} 对查询`,
          value: graph.heaps[heap].med, max, color: V.COLORS[heap],
        }));
      });
      const ratios = DATA.c1000.graphs.map(graph => ({ graph: graph.graph, ratio: graph.heaps.radix.med / graph.heaps.four.med }));
      const consistent = DATA.c1000.graphs.filter(graph => graph.heaps.radix.med < graph.heaps.four.med && graph.heaps.four.med < graph.heaps.fib.med).length;
      const summary = consistent === DATA.c1000.graphs.length
        ? "三个堆的排名与主表一致：radix &lt; four &lt; fib。"
        : "补充数据的排名与主表存在差异，请结合原始 CSV 检查。";
      $("stabilityContent").innerHTML = `<div class="stability-layout"><div class="supplement-card"><div class="card-heading"><span>每查询中位耗时</span><small>1000 对补充查询</small></div><div class="horizontal-bars">${supplementBars(bars)}</div><div class="supplement-summary">${summary}</div></div><aside class="stability-metrics">${ratios.map(item => `<article><span>${item.graph} · radix / four</span><strong>${item.ratio.toFixed(2)}</strong><p>1000 对查询下的相对耗时</p></article>`).join("")}<article><span>数据集排名一致</span><strong>${consistent} / ${DATA.c1000.graphs.length}</strong><p>逐图检查 radix &lt; four &lt; fib</p></article></aside></div>`;
      return;
    }
    if (stabilityMode === "seeds") {
      $("stabilityTitle").textContent = DATA.seeds.rankConsistent ? "排名不依赖一组随机查询" : "查询种子敏感性";
      $("stabilitySubtitle").textContent = "NY / BAY / COL / FLA · seed = 42 / 7 / 99 · 每格 1000 对查询。";
      $("stabilityFootnote").textContent = "seed=42 来自主实验；seed=7/99 为补充实验，只比较相同数据集内的相对排名。";
      const rows = DATA.seeds.graphs.flatMap(graph => graph.seeds.map(item => `<tr><td>${graph.graph}</td><td>${item.seed}</td><td>${item.times.fib.toFixed(1)}</td><td>${item.times.four.toFixed(1)}</td><td>${item.times.radix.toFixed(1)}</td><td>${item.ratio.toFixed(3)}</td></tr>`)).join("");
      $("stabilityContent").innerHTML = `<div class="stability-layout"><div class="supplement-card"><table class="seed-table"><thead><tr><th>图</th><th>seed</th><th>fib</th><th>four</th><th>radix</th><th>radix/four</th></tr></thead><tbody>${rows}</tbody></table></div><aside class="stability-metrics"><article><span>radix / four 范围</span><strong>${DATA.seeds.ratioMin.toFixed(2)}–${DATA.seeds.ratioMax.toFixed(2)}</strong><p>12 个数据集 × 种子组合</p></article><article><span>radix &lt; four &lt; fib</span><strong>${DATA.seeds.rankConsistent ? "12 / 12" : "有差异"}</strong><p>按每个数据集、每个种子分别检查</p></article></aside></div>`;
      return;
    }
    $("stabilityTitle").textContent = "内存，也是一种工程成本";
    $("stabilitySubtitle").textContent = "CTR / USA · 每种堆独立进程 · 各运行 1 条查询，记录峰值 RSS。";
    $("stabilityFootnote").textContent = "独立进程避免 getrusage 高水位继承前一个堆的峰值；内存数字不与查询中位耗时混用。";
    const groups = DATA.rss.graphs.map(graph => {
      const max = Math.max(...Object.values(graph.heaps));
      const bars = DATA.heaps.map(heap => ({ label: heap, value: graph.heaps[heap], max, color: V.COLORS[heap] }));
      return `<section class="rss-group"><h3>${graph.graph}</h3><div class="horizontal-bars rss-bars">${supplementBars(bars, "memory")}</div></section>`;
    }).join("");
    const usa = DATA.rss.graphs.find(graph => graph.graph === "USA");
    const ratio = usa ? usa.heaps.fib / usa.heaps.four : 0;
    const processCount = DATA.rss.graphs.length * DATA.heaps.length;
    $("stabilityContent").innerHTML = `<div class="stability-layout"><div class="supplement-card"><div class="card-heading"><span>峰值常驻内存</span><small>MB · 包含图与查询工作区</small></div><div class="rss-grid">${groups}</div></div><aside class="stability-metrics"><article><span>独立进程</span><strong>${processCount}</strong><p>${DATA.rss.graphs.length} 个数据集 × 7 种堆</p></article>${usa ? `<article><span>USA · Fib / four RSS</span><strong>${ratio.toFixed(2)}×</strong><p>每堆各一条查询的进程峰值</p></article>` : ""}</aside></div>`;
  }

  function setupDataUI() {
    $("explorerHeap").innerHTML = heapOptions("four");
    $("compareA").innerHTML = heapOptions("four");
    $("compareB").innerHTML = heapOptions("radix");
    $("barDataset").innerHTML = DATA.main.map(item => `<option value="${item.graph}" ${item.graph === "USA" ? "selected" : ""}>${item.graph} · ${V.formatInt(item.n)} 节点</option>`).join("");
    $("coordinateSource").href = DEMO.provenance.coordinates;
    $("coordinateSource").title = `坐标 SHA-256: ${DEMO.provenance.coordinateSha256}`;
    const fibRatios = DATA.main.map(item => item.times.fib / item.times.four);
    $("fibRatioRange").textContent = `${Math.min(...fibRatios).toFixed(1)}–${Math.max(...fibRatios).toFixed(1)}×`;
    const usa = DATA.main.at(-1);
    $("usaFibRatio").textContent = `${(usa.times.fib / usa.times.four).toFixed(2)}×`;
    $("decisionSaving").textContent = `${((1 - usa.times.radix / usa.times.four) * 100).toFixed(1)}%`;
    const improvements = DATA.main.map(item => (1 - item.times.four / item.times.bin) * 100);
    $("fourImprovement").textContent = `${Math.min(...improvements).toFixed(1)}–${Math.max(...improvements).toFixed(1)}%`;
    $("decreaseRatios").innerHTML = ["NY", "USA"].map(name => {
      const item = DATA.operations.find(row => row.graph === name);
      const ratio = item.decreases / item.pops * 100;
      return `<div class="decrease-row"><div><strong>${name}</strong><span>${ratio.toFixed(1)}%</span></div><div class="decrease-track"><div class="decrease-fill" style="--ratio:${ratio}%"></div></div><small>${V.formatInt(item.decreases)} decreases / ${V.formatInt(item.pops)} pops</small></div>`;
    }).join("");
    V.scaleChart($("scaleChart"));
    let selected = new Set(["bin", "four", "fib", "radix"]);
    renderRuntimeChart(selected);
    $("runtimeLegend").addEventListener("click", event => {
      const button = event.target.closest("[data-heap]");
      if (!button) return;
      const heap = button.dataset.heap;
      if (selected.has(heap) && selected.size > 1) selected.delete(heap);
      else selected.add(heap);
      renderRuntimeChart(selected);
    });
    $("runtimeAll").addEventListener("click", () => {
      if (selected.size === DATA.heaps.length) selected = new Set(["bin", "four", "fib", "radix"]);
      else selected = new Set(DATA.heaps);
      renderRuntimeChart(selected);
    });
    $("runtimeMetric").addEventListener("click", () => {
      runtimeMode = runtimeMode === "absolute" ? "ratio" : "absolute";
      renderRuntimeChart(selected);
    });
    $("barDataset").addEventListener("change", event => renderBars(event.target.value));
    renderBars("USA");
    renderOperationCounts();
    renderFullResults();
    renderComplexity();
    $("stabilityTabs").addEventListener("click", event => {
      const button = event.target.closest("[data-stability]");
      if (!button || button.hidden) return;
      stabilityMode = button.dataset.stability;
      renderStability();
    });
    renderStability();
  }

  function setupScenes() {
    preparePrefixes();
    const registerOperation = ({ scene, viz, play, reset, labelElement, next = null,
                                duration = 1300, playLabel = "播放机制" }) => {
      const animation = new V.StepAnimation(viz.states.length, duration, index => {
        viz.setStep(index);
        if (labelElement) $(labelElement).textContent = viz.states[index].label || viz.states[index].phase || "";
      });
      controllers.set(scene, new MechanismPlayer({
        animation, playButton: $(play), resetButton: $(reset), nextButton: next ? $(next) : null,
        label: playLabel, resize: () => viz.render(),
      }));
    };

    controllers.set("cover", new TracePlayer({
      map: new V.MapView($("coverMap"), "radix", { subtle: true, padding: { top: 72, right: 38, bottom: 150, left: 38 } }),
      heap: "radix", auto: true, loop: true,
      onUpdate: ({ step, path, trace }) => {
        $("coverMapStatus").textContent = step < trace.pops
          ? `正在确定节点 · ${step} / ${trace.pops}`
          : path < 1 ? "目标已确定 · 回溯最短路径" : `最短距离 ${V.formatInt(trace.distance)} · ${trace.path.length} 个路径节点`;
      },
    }));
    const heapState = new V.HeapStateView($("heapTree"), "four", $("heapStateTitle"), $("heapTreeStats"), $("heapStepInfo"));
    const explorer = new TracePlayer({
      map: new V.MapView($("explorerMap"), "four"), heap: "four", rate: 8,
      playButton: $("explorerPlay"), resetButton: $("explorerReset"), timeline: $("explorerTimeline"),
      speedButton: $("explorerSpeed"), statsElement: $("explorerStats"), distanceElement: $("explorerDistance"),
      onUpdate: ({ step }) => heapState.setStep(step),
    });
    $("explorerHeap").addEventListener("change", event => {
      heapState.setHeap(event.target.value);
      explorer.setHeap(event.target.value);
    });
    controllers.set("dijkstra", explorer);
    controllers.set("compare", new ComparePlayer());

    registerOperation({ scene: "ds-binary", viz: new V.ArrayHeap($("dsBinaryTree"), 2, V.COLORS.bin),
      play: "dsBinaryPlay", reset: "dsBinaryReset", labelElement: "dsBinaryLabel", duration: 1100, playLabel: "插入键 4" });
    registerOperation({ scene: "ds-four", viz: new V.ArrayHeap($("dsFourTree"), 4, V.COLORS.four),
      play: "dsFourPlay", reset: "dsFourReset", labelElement: "dsFourLabel", duration: 1100, playLabel: "插入键 4" });
    registerOperation({ scene: "ds-left", viz: new V.MeldViz($("leftMeld"), "left", V.COLORS.left),
      play: "leftMeldPlay", reset: "leftMeldReset", labelElement: "leftMeldLabel", playLabel: "播放 meld" });
    registerOperation({ scene: "ds-skew", viz: new V.MeldViz($("skewMeld"), "skew", V.COLORS.skew),
      play: "skewMeldPlay", reset: "skewMeldReset", labelElement: "skewMeldLabel", playLabel: "播放 meld" });
    registerOperation({ scene: "ds-binom", viz: new V.BinomialViz($("binomTrees"), V.COLORS.binom),
      play: "binomPlay", reset: "binomReset", labelElement: "binomLabel", playLabel: "播放同度链接" });
    registerOperation({ scene: "ds-fib", viz: new V.FibViz($("fibIntroTree")),
      play: "fibIntroPlay", reset: "fibIntroReset", labelElement: "fibIntroLabel", duration: 1500 });
    registerOperation({ scene: "ds-radix", viz: new V.RadixViz($("radixIntroBuckets"), $("radixIntroLast"), $("radixIntroStepLabel")),
      play: "radixIntroPlay", reset: "radixIntroReset", labelElement: "radixIntroStepLabel",
      next: "radixIntroNext", duration: 1600, playLabel: "播放重分桶" });

    const binary = new V.ArrayHeap($("binaryHeap"), 2, V.COLORS.bin);
    const four = new V.ArrayHeap($("fourHeap"), 4, V.COLORS.four);
    const heapLabels = ["观察两种堆的上滤路径", "插入 4：先放到数组末尾", "二叉堆上滤 1 次；4-ary 已完成", "二叉堆上滤第 2 次；4-ary 保持合法", "相同插入，不同树高与上滤路径"];
    const heapAnimation = new V.StepAnimation(5, 1100, index => {
      binary.setStep(index); four.setStep(index);
      $("heapStepLabel").textContent = heapLabels[index];
    });
    controllers.set("four-results", new MechanismPlayer({
      animation: heapAnimation, playButton: $("heapPlay"), resetButton: $("heapReset"),
      label: "插入键 4", resize: () => { binary.render(); four.render(); },
    }));
    registerOperation({ scene: "fib-results", viz: new V.FibViz($("fibTree")),
      play: "fibPlay", reset: "fibReset", labelElement: "fibPhase", duration: 1500 });
    registerOperation({ scene: "radix-results", viz: new V.RadixViz($("radixBuckets"), $("radixLast"), $("radixStepLabel")),
      play: "radixPlay", reset: "radixReset", labelElement: "radixStepLabel",
      next: "radixNext", duration: 1600, playLabel: "播放重分桶" });

    const qaMap = new V.MapView($("qaMap"), "four", { subtle: true, padding: { top: 40, right: 40, bottom: 40, left: 60 } });
    controllers.set("qa", {
      pause() {}, tick() {}, space() { showSlide(current + 1); },
      enter() { qaMap.resize(); qaMap.setStep(qaMap.trace.pops, 1); },
      resize() { qaMap.resize(); },
      replay() { qaMap.setStep(qaMap.trace.pops, 1); },
    });
  }

  function updateNotes() {
    $("notesTitle").textContent = `${String(current + 1).padStart(2, "0")} · ${slides[current].dataset.title}`;
    $("notesBody").innerHTML = SPEAKER_NOTES[slides[current].dataset.scene] || "";
  }

  function showSlide(index, updateHash = true) {
    index = V.clamp(index, 0, slides.length - 1);
    if (activeController) activeController.pause();
    slides[current].classList.remove("is-active");
    slides[current].setAttribute("aria-hidden", "true");
    slides[current].inert = true;
    current = index;
    slides[current].classList.add("is-active");
    slides[current].removeAttribute("aria-hidden");
    slides[current].inert = false;
    activeController = controllers.get(slides[current].dataset.scene) || null;
    if (updateHash) history.replaceState(null, "", `#${current + 1}`);
    document.title = `${slides[current].dataset.title} · Dijkstra with Heaps`;
    $("pageIndicator").textContent = `${String(current + 1).padStart(2, "0")} / ${slides.length}`;
    $("chapterLabel").textContent = slides[current].dataset.chapter;
    $("previousButton").disabled = current === 0;
    $("nextButton").disabled = current === slides.length - 1;
    [...$("progressSegments").children].forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === current);
      button.classList.toggle("is-past", buttonIndex < current && buttonIndex < appendixStart);
      button.setAttribute("aria-current", buttonIndex === current ? "page" : "false");
    });
    [...$("overviewGrid").children].forEach((button, buttonIndex) => button.classList.toggle("is-current", buttonIndex === current));
    updateNotes();
    $("announcer").textContent = `第 ${current + 1} 页，共 ${slides.length} 页：${slides[current].dataset.title}`;
    if (activeController) activeController.enter();
    if (slides[current].dataset.scene === "robustness") renderStability();
  }

  function toggleNotes(force) {
    notesOpen = typeof force === "boolean" ? force : !notesOpen;
    $("notesPanel").hidden = !notesOpen;
    $("notesButton").setAttribute("aria-pressed", String(notesOpen));
    if (notesOpen) updateNotes();
  }

  function toggleOverview(force) {
    overviewOpen = typeof force === "boolean" ? force : !overviewOpen;
    $("overviewPanel").hidden = !overviewOpen;
    if (overviewOpen) {
      if (activeController) activeController.pause();
      $("closeOverview").focus();
    } else $("overviewButton").focus();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $("announcer").textContent = "浏览器未允许全屏，请使用浏览器的全屏菜单。";
    }
  }

  function fitDeck() {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    document.documentElement.style.setProperty("--deck-scale", scale);
    if (activeController) activeController.resize();
  }

  function openHelp() {
    if (activeController) activeController.pause();
    $("helpDialog").showModal();
  }

  function preparePrint() {
    for (const [scene, controller] of controllers) {
      controller.pause();
      if (controller instanceof TracePlayer) {
        controller.playhead = controller.total();
        controller.update(true);
      } else if (controller instanceof ComparePlayer) {
        controller.progress = 1;
        controller.update(true);
      } else if (controller instanceof MechanismPlayer) {
        controller.animation.index = controller.animation.count - 1;
        controller.animation.onStep(controller.animation.index);
      } else if (scene === "qa") controller.enter();
    }
  }

  function setupNavigation() {
    $("overviewTitle").textContent = `${appendixStart} 个主场景 + ${slides.length - appendixStart} 页备份`;
    $("progressSegments").innerHTML = slides.map((slide, index) => `<button class="${index >= appendixStart ? "is-appendix" : ""}" data-slide="${index}" aria-label="第 ${index + 1} 页：${slide.dataset.title}"></button>`).join("");
    $("overviewGrid").innerHTML = slides.map((slide, index) => `<button class="overview-card ${index >= appendixStart ? "is-appendix" : ""}" data-slide="${index}"><span>${String(index + 1).padStart(2, "0")} / ${index >= appendixStart ? "BACKUP" : "MAIN"}</span><strong>${slide.dataset.title}</strong><small>${slide.dataset.chapter}</small></button>`).join("");
    const goToButton = event => {
      const button = event.target.closest("[data-slide]");
      if (!button) return;
      toggleOverview(false);
      showSlide(Number(button.dataset.slide));
    };
    $("progressSegments").addEventListener("click", event => {
      const button = event.target.closest("[data-slide]");
      if (button) showSlide(Number(button.dataset.slide));
    });
    $("overviewGrid").addEventListener("click", goToButton);
    $("previousButton").addEventListener("click", () => showSlide(current - 1));
    $("nextButton").addEventListener("click", () => showSlide(current + 1));
    $("homeButton").addEventListener("click", () => showSlide(0));
    document.querySelectorAll("[data-next]").forEach(button => button.addEventListener("click", () => showSlide(current + 1)));
    document.querySelectorAll("[data-appendix]").forEach(button => button.addEventListener("click", () => showSlide(appendixStart)));
    $("overviewButton").addEventListener("click", () => toggleOverview());
    $("closeOverview").addEventListener("click", () => toggleOverview(false));
    $("notesButton").addEventListener("click", () => toggleNotes());
    $("closeNotes").addEventListener("click", () => toggleNotes(false));
    $("fullscreenButton").addEventListener("click", toggleFullscreen);
    $("helpButton").addEventListener("click", openHelp);
    $("closeHelp").addEventListener("click", () => $("helpDialog").close());
    $("helpDialog").addEventListener("click", event => {
      if (event.target === $("helpDialog")) $("helpDialog").close();
    });
    document.addEventListener("keydown", event => {
      if ($("helpDialog").open) return;
      if (event.target.matches("input, select, textarea") || event.target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (overviewOpen) toggleOverview(false);
        else if (notesOpen) toggleNotes(false);
        return;
      }
      if (key === " " && event.target.closest("button, a")) return;
      const actions = {
        arrowright: () => showSlide(current + 1),
        pagedown: () => showSlide(current + 1),
        arrowleft: () => showSlide(current - 1),
        pageup: () => showSlide(current - 1),
        home: () => showSlide(0),
        end: () => showSlide(qaIndex),
        " ": () => activeController ? activeController.space() : showSlide(current + 1),
        r: () => activeController && activeController.replay(),
        f: toggleFullscreen,
        n: () => toggleNotes(),
        o: () => toggleOverview(),
        q: () => showSlide(qaIndex),
        a: () => showSlide(appendixStart),
        "?": openHelp,
      };
      if (!actions[key]) return;
      event.preventDefault();
      actions[key]();
    });
    window.addEventListener("resize", fitDeck);
    window.addEventListener("hashchange", () => {
      const index = Number(location.hash.replace(/\D/g, "")) - 1;
      if (Number.isInteger(index) && index >= 0 && index < slides.length && index !== current) showSlide(index, false);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && activeController) activeController.pause();
    });
    document.addEventListener("fullscreenchange", fitDeck);
    window.addEventListener("beforeprint", preparePrint);
  }

  function init() {
    setupDataUI();
    setupScenes();
    setupNavigation();
    fitDeck();
    const requested = Number(location.hash.replace(/\D/g, "")) - 1;
    showSlide(Number.isInteger(requested) && requested >= 0 && requested < slides.length ? requested : 0, false);
    let previousTime = performance.now();
    function frame(now) {
      const dt = Math.min(now - previousTime, 60);
      previousTime = now;
      if (activeController && !document.hidden) activeController.tick(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  init();
})();
