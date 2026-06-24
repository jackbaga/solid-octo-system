import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Button, Empty, Layout, Space, Typography } from 'antd';

const { Header, Content } = Layout;

export function TaskCompletionPage() {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} href="#/" />
          <Typography.Title level={3} className="app-title">
            任务完成度
          </Typography.Title>
        </Space>
      </Header>
      <Content className="app-content placeholder-content">
        <Empty image={<CheckCircleOutlined />} description="任务完成度模块待开发" />
      </Content>
    </Layout>
  );
}
