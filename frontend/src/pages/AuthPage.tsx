import axios from 'axios';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Layout, Segmented, Typography, message } from 'antd';
import { useState } from 'react';
import { AuthUser, login, register } from '../services/authApi';

const { Content } = Layout;

interface AuthPageProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: string[] } | undefined;

    if (data?.errors?.length) {
      return data.errors.join('\n');
    }

    if (data?.message) {
      return data.message;
    }
  }

  return '操作失败，请稍后重试';
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function handleSubmit(values: { username: string; password: string }) {
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await login(values.username, values.password)
        : await register(values.username, values.password);
      onAuthenticated(result.user, result.token);
      messageApi.success(mode === 'login' ? '登录成功' : '注册成功');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout className="auth-shell">
      {contextHolder}
      <Content className="auth-content">
        <Card className="auth-card">
          <Typography.Title level={2} className="auth-title">
            实验室志愿者管理系统
          </Typography.Title>
          <Typography.Text className="auth-subtitle">
            使用账号密码登录
          </Typography.Text>
          <Segmented
            block
            value={mode}
            onChange={(value) => setMode(value as 'login' | 'register')}
            options={[
              { label: '登录', value: 'login' },
              { label: '注册', value: 'register' }
            ]}
            className="auth-switch"
          />
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="username"
              label="账号"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {mode === 'login' ? '登录' : '注册并登录'}
            </Button>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
}
