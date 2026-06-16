import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { CallManagementPage } from './pages/CallManagementPage';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <CallManagementPage />
    </ConfigProvider>
  );
}
