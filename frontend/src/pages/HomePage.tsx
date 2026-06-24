import {
  CheckCircleOutlined,
  CalendarOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import { Button, Layout, Space, Typography } from 'antd';

const { Content } = Layout;

export function HomePage() {
  return (
    <Layout className="home-shell">
      <Content className="home-content">
        <div className="home-heading">
          <Typography.Title level={1} className="home-title">
            CCBD-北大
          </Typography.Title>
          <Typography.Text className="home-subtitle">
            实验室志愿者管理系统
          </Typography.Text>
        </div>

        <Space className="home-actions" size={16} wrap>
          <Button
            className="home-action-button"
            icon={<CalendarOutlined />}
            size="large"
            href="/appointments"
          >
            预约
          </Button>
          <Button
            className="home-action-button"
            icon={<PhoneOutlined />}
            size="large"
            type="primary"
            href="#/call"
          >
            致电
          </Button>
          <Button
            className="home-action-button"
            icon={<CheckCircleOutlined />}
            size="large"
            href="#/tasks"
          >
            任务完成度
          </Button>
        </Space>
      </Content>
    </Layout>
  );
}
