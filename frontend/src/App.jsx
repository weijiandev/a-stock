import { useMemo, useState } from "react";
import {
  Button,
  Card,
  ConfigProvider,
  DatePicker,
  Divider,
  Form,
  Input,
  Layout,
  List,
  message,
  Progress,
  Switch,
  Tag,
  Typography
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { fetchSignals, fetchStockData, fetchSummary } from "./utils/api.js";

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const defaultWatchlist = ["600519", "000001", "300750", "601318"];

const formatDateParam = (date) => date.format("YYYYMMDD");

const buildChartOptions = (records) => {
  const dates = records.map((item) => item.date);
  const candle = records.map((item) => [item.open, item.close, item.low, item.high]);
  const ma5 = records.map((item) => item.ma5);
  const ma20 = records.map((item) => item.ma20);
  const macd = records.map((item) => item.histogram);
  const signal = records.map((item) => item.signal);
  const rsi = records.map((item) => item.rsi14);

  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: { data: ["K线", "MA5", "MA20"] },
    grid: [
      { left: 40, right: 20, top: 40, height: 260 },
      { left: 40, right: 20, top: 330, height: 100 },
      { left: 40, right: 20, top: 460, height: 100 }
    ],
    xAxis: [
      { type: "category", data: dates, gridIndex: 0 },
      { type: "category", data: dates, gridIndex: 1 },
      { type: "category", data: dates, gridIndex: 2 }
    ],
    yAxis: [
      { scale: true, gridIndex: 0 },
      { scale: true, gridIndex: 1 },
      { scale: true, gridIndex: 2 }
    ],
    series: [
      { type: "candlestick", name: "K线", data: candle },
      { type: "line", name: "MA5", data: ma5, smooth: true, showSymbol: false },
      { type: "line", name: "MA20", data: ma20, smooth: true, showSymbol: false },
      { type: "bar", name: "MACD", data: macd, xAxisIndex: 1, yAxisIndex: 1 },
      { type: "line", name: "信号线", data: signal, xAxisIndex: 1, yAxisIndex: 1 },
      { type: "line", name: "RSI", data: rsi, xAxisIndex: 2, yAxisIndex: 2 }
    ]
  };
};

const exportToCsv = (records) => {
  if (!records.length) {
    message.warning("暂无数据可导出。");
    return;
  }

  const header = Object.keys(records[0]).join(",");
  const rows = records
    .map((row) =>
      Object.values(row)
        .map((value) => (value === null || value === undefined ? "" : value))
        .join(",")
    )
    .join("\n");

  const csvContent = `${header}\n${rows}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "stock-data.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function App() {
  const [themeDark, setThemeDark] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState(defaultWatchlist[0]);
  const [watchlist, setWatchlist] = useState(defaultWatchlist);
  const [records, setRecords] = useState([]);
  const [signals, setSignals] = useState([]);
  const [summary, setSummary] = useState("等待分析。");
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState([
    dayjs().subtract(120, "day"),
    dayjs()
  ]);

  const chartOptions = useMemo(() => buildChartOptions(records), [records]);

  const handleSearch = async (values) => {
    const symbol = values.symbol?.trim();
    if (!symbol) {
      message.warning("请输入股票代码。");
      return;
    }

    if (!watchlist.includes(symbol)) {
      setWatchlist((prev) => [symbol, ...prev]);
    }

    setSelectedSymbol(symbol);
    await handleAnalyze(symbol, range);
  };

  const handleAnalyze = async (symbolOverride, rangeOverride) => {
    const symbol = symbolOverride ?? selectedSymbol;
    const [start, end] = rangeOverride ?? range;
    if (!start || !end) {
      message.warning("请选择日期范围。");
      return;
    }

    setLoading(true);
    try {
      const startParam = formatDateParam(start);
      const endParam = formatDateParam(end);
      const [dataResponse, signalResponse, summaryResponse] = await Promise.all([
        fetchStockData(symbol, startParam, endParam),
        fetchSignals(symbol, startParam, endParam),
        fetchSummary(symbol, startParam, endParam)
      ]);
      setRecords(dataResponse.data ?? []);
      setSignals(signalResponse.signals ?? []);
      setSummary(summaryResponse.summary ?? "暂无摘要。");
    } catch (error) {
      message.error("获取数据失败，请检查后端服务或参数。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: themeDark
          ? ConfigProvider.theme.darkAlgorithm
          : ConfigProvider.theme.defaultAlgorithm,
        token: { colorPrimary: "#3b82f6" }
      }}
    >
      <Layout className="app-shell">
        <Header className="app-header">
          <Title level={3} style={{ margin: 0, color: "inherit" }}>
            A 股智能分析仪表盘
          </Title>
          <div className="header-actions">
            <Button type="link">关于</Button>
            <span className="theme-label">暗色主题</span>
            <Switch checked={themeDark} onChange={setThemeDark} />
          </div>
        </Header>
        <Layout>
          <Sider width={240} className="app-sider">
            <Form onFinish={handleSearch} layout="vertical">
              <Form.Item label="股票代码" name="symbol">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="如 600519"
                  allowClear
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                查询
              </Button>
            </Form>
            <Divider />
            <Text type="secondary">自选股</Text>
            <List
              className="watchlist"
              dataSource={watchlist}
              renderItem={(item) => (
                <List.Item
                  className={item === selectedSymbol ? "active" : ""}
                  onClick={() => handleAnalyze(item, range)}
                >
                  {item}
                </List.Item>
              )}
            />
          </Sider>
          <Content className="app-content">
            <Card
              title="行情与指标"
              extra={
                <Button onClick={() => exportToCsv(records)}>导出 CSV</Button>
              }
            >
              {records.length ? (
                <ReactECharts option={chartOptions} style={{ height: 580 }} />
              ) : (
                <div className="empty-state">
                  <Text type="secondary">暂无数据，请点击右侧分析。</Text>
                </div>
              )}
            </Card>
          </Content>
          <Sider width={320} className="app-aside">
            <Card title="分析面板">
              <Form layout="vertical">
                <Form.Item label="日期范围">
                  <DatePicker.RangePicker
                    value={range}
                    onChange={(value) => setRange(value)}
                  />
                </Form.Item>
                <Form.Item label="指标参数">
                  <Input placeholder="MA5/MA20, RSI14" disabled />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  onClick={() => handleAnalyze()}
                >
                  分析
                </Button>
              </Form>
              <Divider />
              <Text strong>AI 摘要</Text>
              <div className="summary-box">{summary}</div>
              <Divider />
              <Text strong>交易信号</Text>
              <div className="signal-tags">
                {signals.map((signal) => (
                  <Tag key={signal} color="blue">
                    {signal}
                  </Tag>
                ))}
              </div>
            </Card>
          </Sider>
        </Layout>
        <Footer className="app-footer">
          <div className="footer-status">
            {loading ? (
              <Progress percent={60} status="active" showInfo={false} />
            ) : (
              <Text type="secondary">数据已更新，等待下一次刷新。</Text>
            )}
          </div>
        </Footer>
      </Layout>
    </ConfigProvider>
  );
}
