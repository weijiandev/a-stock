from __future__ import annotations

from datetime import datetime
from typing import List

import akshare as ak
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="A-Stock Analyzer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_stock_data(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch daily stock data from AKShare.

    Args:
        symbol: Stock code, e.g. "600519".
        start_date: Start date in YYYYMMDD format.
        end_date: End date in YYYYMMDD format.

    Returns:
        DataFrame with columns: date, open, high, low, close, volume.
    """
    try:
        raw_df = ak.stock_zh_a_hist(
            symbol=symbol,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="",
        )
    except Exception as exc:  # pragma: no cover - dependent on upstream
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {exc}") from exc

    if raw_df.empty:
        raise HTTPException(status_code=404, detail="No data returned for symbol.")

    df = raw_df.rename(
        columns={
            "日期": "date",
            "开盘": "open",
            "收盘": "close",
            "最高": "high",
            "最低": "low",
            "成交量": "volume",
        }
    )[["date", "open", "high", "low", "close", "volume"]]

    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    return df


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate MA, MACD, RSI indicators."""
    df = df.copy()
    df["ma5"] = df["close"].rolling(window=5).mean()
    df["ma20"] = df["close"].rolling(window=20).mean()

    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["histogram"] = df["macd"] - df["signal"]

    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi14"] = 100 - (100 / (1 + rs))

    return df


def infer_signals(df: pd.DataFrame) -> List[str]:
    """Generate simple trading signals based on indicators."""
    signals: List[str] = []
    if len(df) < 2:
        return ["数据不足，无法生成信号。"]

    latest = df.iloc[-1]
    prev = df.iloc[-2]

    if prev["macd"] < prev["signal"] and latest["macd"] > latest["signal"]:
        signals.append("MACD 金叉：可能出现上行动能。")
    if prev["macd"] > prev["signal"] and latest["macd"] < latest["signal"]:
        signals.append("MACD 死叉：可能出现下行动能。")

    if latest["rsi14"] > 70:
        signals.append("RSI 超买：注意回调风险。")
    elif latest["rsi14"] < 30:
        signals.append("RSI 超卖：关注反弹机会。")

    if not signals:
        signals.append("暂无明显交易信号。")

    return signals


def build_summary(symbol: str, df: pd.DataFrame) -> str:
    """Generate a placeholder summary based on latest indicators."""
    latest = df.iloc[-1]
    return (
        f"{symbol} 最新收盘价为 {latest['close']:.2f}，"
        f"MA5/MA20 分别为 {latest['ma5']:.2f}/{latest['ma20']:.2f}，"
        "建议结合成交量与基本面进一步观察。"
    )


@app.get("/api/stocks/{symbol}")
async def get_stock_data(
    symbol: str,
    start_date: str = Query(..., description="YYYYMMDD"),
    end_date: str = Query(..., description="YYYYMMDD"),
):
    df = fetch_stock_data(symbol, start_date, end_date)
    df = add_indicators(df)
    records = df.replace({np.nan: None}).to_dict(orient="records")
    return {"symbol": symbol, "data": records}


@app.get("/api/signals/{symbol}")
async def get_signals(
    symbol: str,
    start_date: str = Query(..., description="YYYYMMDD"),
    end_date: str = Query(..., description="YYYYMMDD"),
):
    df = fetch_stock_data(symbol, start_date, end_date)
    df = add_indicators(df)
    return {"symbol": symbol, "signals": infer_signals(df)}


@app.get("/api/summary/{symbol}")
async def get_summary(
    symbol: str,
    start_date: str = Query(..., description="YYYYMMDD"),
    end_date: str = Query(..., description="YYYYMMDD"),
):
    df = fetch_stock_data(symbol, start_date, end_date)
    df = add_indicators(df)
    return {
        "symbol": symbol,
        "summary": build_summary(symbol, df),
        "generated_at": datetime.utcnow().isoformat(),
    }
