#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 GitHub 社交预览图（1280x640）。
品牌视觉与 assets/icon.png 同源：靛蓝->紫罗兰渐变圆角标 + 对勾 + 进度环。
依赖：Pillow（仅用于生成资源，非运行时依赖）。
  pip install Pillow
运行：python scripts/gen_social.py  ->  assets/social-preview.png
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 640

# 字体（Windows 系统 CJK 字体）
REG = "C:/Windows/Fonts/msyh.ttc"
BOLD = "C:/Windows/Fonts/msyhbd.ttc"

def font(path, size):
    return ImageFont.truetype(path, size)

def round_rect_mask(size, r):
    """返回 L 模式圆角矩形遮罩（白色圆角内，黑色外）。"""
    w, h = size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m

def diagonal_gradient(size, c1, c2):
    """对角线性渐变 RGBA 图。"""
    w, h = size
    img = Image.new("RGBA", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / (w - 1) + y / (h - 1)) / 2
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            px[x, y] = (r, g, b, 255)
    return img

# ---------- 背景 ----------
bg = Image.new("RGBA", (W, H), (11, 16, 32, 255))  # #0B1020
# 轻微对角光晕，增加层次
glow = diagonal_gradient((W, H), (28, 32, 64, 255), (11, 16, 32, 255))
bg = Image.alpha_composite(bg, Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), glow, 0.35))

# ---------- 品牌圆角标 ----------
MS = 300
indigo = (79, 70, 229)    # #4F46E5
violet = (124, 58, 237)   # #7C3AED
grad = diagonal_gradient((MS, MS), indigo, violet)
mark = Image.new("RGBA", (MS, MS), (0, 0, 0, 0))
mk = ImageDraw.Draw(mark)
mark.paste(grad, (0, 0), round_rect_mask((MS, MS), 64))

# 进度环（底部开口 ~240°）
cx, cy = MS // 2, MS // 2
ring_r = MS // 2 - 30
bbox = [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r]
mk.arc(bbox, start=150, end=390, fill=(255, 255, 255, 55), width=14)   # 轨道
mk.arc(bbox, start=150, end=150 + 240, fill=(255, 255, 255, 230), width=14)  # 进度

# 对勾
check = [(cx - 46, cy + 6), (cx - 12, cy + 40), (cx + 52, cy - 34)]
mk.line(check, fill=(255, 255, 255, 255), width=24, joint="curve")

# 贴到背景左侧居中
mx, my = 130, (H - MS) // 2
bg.paste(mark, (mx, my), mark)

# ---------- 文字 ----------
d = ImageDraw.Draw(bg)
tx = 500  # 文字区起点 x

# 笃行（大标题）
f_title = font(BOLD, 138)
title = "笃行"
tb = d.textbbox((0, 0), title, font=f_title)
tw = tb[2] - tb[0]
d.text((tx, 196), title, font=f_title, fill=(255, 255, 255, 255))

# DUXING（字距拉开的小标）
f_sub = font(REG, 46)
duxing = "D U X I N G"
d.text((tx + 4, 350), duxing, font=font(REG, 46), fill=(156, 163, 255, 255))

# 分隔线
d.line([(tx, 432), (tx + 760, 432)], fill=(255, 255, 255, 40), width=2)

# 副标题
f_desc = font(REG, 40)
desc = "本地优先的 AI 待办桌面应用"
d.text((tx, 462), desc, font=f_desc, fill=(199, 203, 214, 255))

# 技术标签 pills
chips = ["Electron", "React", "离线可用", "自然语言建任务"]
chip_font = font(REG, 30)
pad_x, pad_y, gap = 22, 12, 16
x = tx
y = 540
for c in chips:
    cb = d.textbbox((0, 0), c, font=chip_font)
    cw = cb[2] - cb[0]
    ch = cb[3] - cb[1]
    box = [x, y, x + cw + pad_x * 2, y + ch + pad_y * 2]
    d.rounded_rectangle(box, radius=18, outline=(255, 255, 255, 70), width=2)
    d.text((x + pad_x, y + pad_y), c, font=chip_font, fill=(226, 228, 235, 255))
    x = box[2] + gap

out = "assets/social-preview.png"
bg.convert("RGB").save(out, "PNG")
print("saved", out, bg.size)
