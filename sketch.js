// ============================================================
//  HandPose + ML5.js  互動藝術 — sketch.js
//  功能：手部偵測、手指連線、水泡效果、WebGL 支援檢查
// ============================================================

let video;
let handpose;
let hands = [];           // 偵測到的手部資料
let bubbles = [];         // 水泡陣列
let modelReady = false;
let webGLSupported = false;
let statusMsg = '初始化中...';

// 指尖關鍵點編號（產生水泡的位置）
const FINGERTIPS = [4, 8, 12, 16, 20];

// 每根手指的關鍵點範圍（用 line 串接）
const FINGER_GROUPS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20]
];

// ── WebGL 支援檢查 ────────────────────────────────────────────
function checkWebGL() {
  try {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    webGLSupported = !!(ctx && ctx instanceof WebGLRenderingContext);
  } catch (e) {
    webGLSupported = false;
  }
  return webGLSupported;
}

// ── 初始化 ───────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('sans-serif');

  // 檢查 WebGL
  checkWebGL();
  if (!webGLSupported) {
    statusMsg = '⚠ 此裝置不支援 WebGL，模型可能無法運作';
  } else {
    statusMsg = '✓ WebGL 支援正常，模型載入中...';
  }

  // 攝影機
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 載入 HandPose 模型
  try {
    handpose = ml5.handpose(video, { flipHorizontal: true }, () => {
      modelReady = true;
      statusMsg = '✓ WebGL 正常 ｜ ✓ 模型載入成功';
      console.log('Handpose model ready');
    });
    handpose.on('predict', results => {
      hands = results;
    });
  } catch (e) {
    statusMsg = '✗ 模型載入失敗：' + e.message;
    console.error(e);
  }
}

// ── 視窗縮放自動調整 ─────────────────────────────────────────
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ── 主繪圖迴圈 ───────────────────────────────────────────────
function draw() {
  // 背景色 #e7c6ff
  background('#e7c6ff');

  // ── 攝影機影像置中，寬高為畫布 50% ──────────────────────
  let vw = width  * 0.5;
  let vh = height * 0.5;
  let vx = (width  - vw) / 2;
  let vy = (height - vh) / 2;

  // 顯示攝影機畫面（已在 ml5 設定 flipHorizontal，不需要額外 translate/scale）
  push();
    // 手動做水平翻轉
    translate(vx + vw, vy);
    scale(-1, 1);
    image(video, 0, 0, vw, vh);
  pop();

  // ── 畫手指線條與關鍵點 ──────────────────────────────────
  if (modelReady && hands.length > 0) {
    for (let h = 0; h < hands.length; h++) {
      let kp = hands[h].landmarks; // 21 個 [x, y, z]

      // 把模型座標（640x480）映射到顯示區域
      function mapX(x) { return vx + map(x, 0, 640, vw, 0); } // flipHorizontal
      function mapY(y) { return vy + map(y, 0, 480, 0, vh); }

      // 手指連線
      for (let g = 0; g < FINGER_GROUPS.length; g++) {
        let group = FINGER_GROUPS[g];
        strokeWeight(3);
        stroke(150, 80, 220, 200);
        noFill();
        beginShape();
        for (let i = 0; i < group.length; i++) {
          let pt = kp[group[i]];
          vertex(mapX(pt[0]), mapY(pt[1]));
        }
        endShape();
      }

      // 所有關鍵點小圓圈
      noStroke();
      fill(220, 120, 255, 220);
      for (let i = 0; i < kp.length; i++) {
        ellipse(mapX(kp[i][0]), mapY(kp[i][1]), 10, 10);
      }

      // 指尖產生水泡
      for (let t = 0; t < FINGERTIPS.length; t++) {
        let tip = kp[FINGERTIPS[t]];
        let tx = mapX(tip[0]);
        let ty = mapY(tip[1]);

        // 每幀有一定機率從指尖生成水泡
        if (random() < 0.12) {
          bubbles.push(new Bubble(tx, ty));
        }
      }
    }
  }

  // ── 更新與繪製水泡 ───────────────────────────────────────
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].update();
    bubbles[i].draw();
    if (bubbles[i].isDead()) {
      bubbles.splice(i, 1);
    }
  }

  // ── 置中上方標題文字 ─────────────────────────────────────
  drawTitle();

  // ── 狀態訊息（左下角）───────────────────────────────────
  drawStatus();
}

// ── 標題文字 ─────────────────────────────────────────────────
function drawTitle() {
  push();
    textAlign(CENTER, TOP);
    textSize(min(width * 0.045, 48));
    textStyle(BOLD);

    // 陰影
    fill(180, 100, 230, 120);
    text('414730670 呂俞錚', width / 2 + 2, 22);

    // 主文字
    fill(90, 20, 160);
    text('414730670 呂俞錚', width / 2, 20);
  pop();
}

// ── 狀態訊息 ─────────────────────────────────────────────────
function drawStatus() {
  push();
    textAlign(LEFT, BOTTOM);
    textSize(13);
    textStyle(NORMAL);

    let isError = statusMsg.includes('✗') || statusMsg.includes('⚠');
    fill(isError ? color(200, 50, 50) : color(60, 120, 60));

    // 半透明背景
    let tw = textWidth(statusMsg) + 20;
    noStroke();
    fill(255, 255, 255, 160);
    rect(8, height - 34, tw, 26, 6);

    fill(isError ? color(180, 30, 30) : color(30, 100, 30));
    text(statusMsg, 18, height - 12);
  pop();
}

// ============================================================
//  Bubble 水泡類別
// ============================================================
class Bubble {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = random(8, 22);           // 初始半徑
    this.vx = random(-0.8, 0.8);      // 左右飄移
    this.vy = random(-2.5, -1.2);     // 上升速度
    this.alpha = 220;
    this.popping = false;
    this.popFrame = 0;
    this.popMaxFrame = 8;

    // 水泡破掉的 y 位置（隨機高度）
    this.popY = y - random(80, 220);
  }

  update() {
    if (this.popping) {
      this.popFrame++;
      this.r += 3;
      this.alpha -= 255 / this.popMaxFrame;
      return;
    }

    this.x += this.vx + sin(frameCount * 0.05 + this.y) * 0.5;
    this.y += this.vy;
    this.r  += 0.06; // 緩慢變大

    // 到達破掉位置
    if (this.y <= this.popY) {
      this.popping = true;
    }
  }

  draw() {
    push();
      noFill();
      let a = max(0, this.alpha);

      if (this.popping) {
        // 破掉效果：放大透明圓圈
        stroke(180, 100, 255, a);
        strokeWeight(2);
        ellipse(this.x, this.y, this.r * 2);

        // 小碎點
        fill(200, 150, 255, a);
        noStroke();
        for (let i = 0; i < 6; i++) {
          let angle = TWO_PI / 6 * i + this.popFrame * 0.3;
          let d = this.r * 0.8;
          ellipse(
            this.x + cos(angle) * d,
            this.y + sin(angle) * d,
            4, 4
          );
        }
      } else {
        // 正常水泡
        strokeWeight(1.5);
        stroke(200, 150, 255, a);
        ellipse(this.x, this.y, this.r * 2);

        // 高光
        fill(255, 255, 255, a * 0.5);
        noStroke();
        ellipse(
          this.x - this.r * 0.3,
          this.y - this.r * 0.3,
          this.r * 0.4
        );
      }
    pop();
  }

  isDead() {
    return this.popping && this.popFrame >= this.popMaxFrame;
  }
}