# A 股智能分析 Web 应用

本项目提供 A 股行情查询、技术指标计算、交易信号展示与 AI 摘要功能。该应用仅供学习与研究，不构成任何投资建议，也不包含实盘交易功能。

## 目录结构

```
backend/   # FastAPI + AKShare 数据服务
frontend/  # React + Ant Design 仪表盘
```

## 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

访问接口文档：`http://localhost:8000/docs`

## 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问页面：`http://localhost:5173`

## 后续可扩展方向

- 自定义指标与参数配置
- 策略回测与绩效评估
- 导出 PDF 报告或邮件推送
