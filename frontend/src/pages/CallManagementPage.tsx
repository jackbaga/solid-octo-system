import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LogoutOutlined,
  PlusOutlined,
  TableOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { Button, Input, Layout, message, Modal, Popconfirm, Space, Table, Tag, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { StatusFilter } from '../components/StatusFilter';
import { VolunteerFormModal } from '../components/VolunteerFormModal';
import { statusColors, statusLabels, teacherLabels } from '../constants/volunteer';
import {
  createVolunteer,
  createVolunteerSheet,
  deleteVolunteer,
  deleteVolunteerSheet,
  exportVolunteers,
  fetchVolunteerSheets,
  fetchVolunteers,
  importVolunteers,
  updateVolunteerSheet,
  updateVolunteer
} from '../services/volunteerApi';
import {
  CreateVolunteerPayload,
  UpdateVolunteerPayload,
  Volunteer,
  VolunteerSheet,
  VolunteerStatus
} from '../types/volunteer';

const { Header, Content } = Layout;

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

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '操作失败，请稍后重试';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CallManagementPage() {
  const [sheets, setSheets] = useState<VolunteerSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [statusFilter, setStatusFilter] = useState<VolunteerStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetModalLoading, setSheetModalLoading] = useState(false);
  const [sheetModalMode, setSheetModalMode] = useState<'create' | 'edit'>('create');
  const [editingSheet, setEditingSheet] = useState<VolunteerSheet | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.dispatchEvent(new Event('auth:logout'));
  }

  async function loadSheets(nextSelectedSheetId = selectedSheetId) {
    try {
      const data = await fetchVolunteerSheets();
      setSheets(data);

      if (!data.length) {
        setSelectedSheetId(null);
        return;
      }

      const selectedStillExists = nextSelectedSheetId
        ? data.some((sheet) => sheet.id === nextSelectedSheetId)
        : false;
      setSelectedSheetId(selectedStillExists ? nextSelectedSheetId : data[0].id);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  async function loadVolunteers(nextStatus = statusFilter, nextSheetId = selectedSheetId) {
    if (!nextSheetId) {
      setVolunteers([]);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchVolunteers(nextStatus, nextSheetId);
      setVolunteers(data);
    } catch {
      messageApi.error('志愿者列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSheets();
  }, []);

  useEffect(() => {
    loadVolunteers();
  }, [statusFilter, selectedSheetId]);

  function openCreateSheetModal() {
    setSheetModalMode('create');
    setEditingSheet(null);
    setSheetName('');
    setSheetModalOpen(true);
  }

  function openRenameSheetModal(sheet: VolunteerSheet) {
    setSheetModalMode('edit');
    setEditingSheet(sheet);
    setSheetName(sheet.name);
    setSheetModalOpen(true);
  }

  function closeSheetModal() {
    setSheetModalOpen(false);
    setEditingSheet(null);
    setSheetName('');
  }

  async function handleSheetSubmit() {
    const name = sheetName.trim();

    if (!name) {
      messageApi.warning('请输入表格名称');
      return;
    }

    setSheetModalLoading(true);
    try {
      if (sheetModalMode === 'create') {
        const sheet = await createVolunteerSheet(name);
        messageApi.success('表格已新建');
        closeSheetModal();
        await loadSheets(sheet.id);
      } else if (editingSheet) {
        const sheet = await updateVolunteerSheet(editingSheet.id, name);
        messageApi.success('表格名称已更新');
        closeSheetModal();
        await loadSheets(sheet.id);
      }
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSheetModalLoading(false);
    }
  }

  async function handleDeleteSheet(sheet: VolunteerSheet) {
    try {
      await deleteVolunteerSheet(sheet.id);
      messageApi.success('表格已删除');
      await loadSheets(sheet.id === selectedSheetId ? null : selectedSheetId);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  function openCreateModal() {
    setModalMode('create');
    setEditingVolunteer(null);
    setModalOpen(true);
  }

  function openEditModal(volunteer: Volunteer) {
    setModalMode('edit');
    setEditingVolunteer(volunteer);
    setModalOpen(true);
  }

  function closeVolunteerModal() {
    setModalOpen(false);
    setEditingVolunteer(null);
  }

  async function handleSubmit(payload: CreateVolunteerPayload | UpdateVolunteerPayload) {
    if (modalMode === 'create' && !selectedSheetId) {
      messageApi.error('请先选择一个表格');
      return;
    }

    setModalLoading(true);
    try {
      if (modalMode === 'create') {
        await createVolunteer({ ...(payload as CreateVolunteerPayload), sheetId: selectedSheetId ?? undefined });
        messageApi.success('志愿者已新增');
      } else if (editingVolunteer) {
        await updateVolunteer(editingVolunteer.id, payload as UpdateVolunteerPayload);
        messageApi.success('志愿者信息已更新');
      }

      closeVolunteerModal();
      await loadVolunteers();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteVolunteer(id);
      messageApi.success('志愿者已删除');
      await loadVolunteers();
    } catch {
      messageApi.error('删除失败');
    }
  }

  const handleImport: UploadProps['customRequest'] = async ({ file, onError, onSuccess }) => {
    try {
      if (!(file instanceof File)) {
        throw new Error('请选择 .xlsx 文件');
      }

      if (!selectedSheetId) {
        throw new Error('请先选择一个表格');
      }

      const result = await importVolunteers(file, selectedSheetId);
      messageApi.success(`导入完成：新增 ${result.created} 条，更新 ${result.updated} 条`);
      await loadVolunteers();
      onSuccess?.(result);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      messageApi.error(errorMessage);
      onError?.(error as Error);
    }
  };

  async function handleExport() {
    try {
      const currentSheet = sheets.find((sheet) => sheet.id === selectedSheetId);
      const filename = `${currentSheet?.name ?? '志愿者名单'}.xlsx`;
      const blob = await exportVolunteers(statusFilter, selectedSheetId ?? undefined);
      downloadBlob(blob, filename);
      messageApi.success('导出完成');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  const columns: ColumnsType<Volunteer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 160
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 100,
      render: (age: number | null) => age ?? '-'
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 180
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: VolunteerStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '负责老师',
      dataIndex: 'teacher',
      key: 'teacher',
      width: 140,
      render: (teacher: Volunteer['teacher']) => (teacher ? teacherLabels[teacher] : '-')
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 220,
      ellipsis: true,
      render: (remark: string | null) => remark || '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该志愿者？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} href="#/" />
          <Typography.Title level={3} className="app-title">
            致电管理
          </Typography.Title>
        </Space>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增志愿者
          </Button>
          <Upload
            accept=".xlsx"
            customRequest={handleImport}
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>
            导入表格
            </Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出表格
          </Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        <div className="sheet-tabs-bar">
          <Space wrap size={8}>
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className={`sheet-tab ${sheet.id === selectedSheetId ? 'active' : ''}`}
              >
                <Button
                  type="text"
                  icon={<TableOutlined />}
                  onClick={() => setSelectedSheetId(sheet.id)}
                >
                  {sheet.name}
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openRenameSheetModal(sheet)}
                />
                <Popconfirm
                  title={`确认删除「${sheet.name}」？`}
                  description="删除后，该表格内的志愿者信息也会被删除。"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDeleteSheet(sheet)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={sheets.length <= 1}
                  />
                </Popconfirm>
              </div>
            ))}
            <Button icon={<PlusOutlined />} onClick={openCreateSheetModal}>
              新建表格
            </Button>
          </Space>
        </div>

        <div className="toolbar">
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={volunteers}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1120 }}
        />
      </Content>

      <VolunteerFormModal
        open={modalOpen}
        mode={modalMode}
        volunteer={editingVolunteer}
        confirmLoading={modalLoading}
        onCancel={closeVolunteerModal}
        onSubmit={handleSubmit}
      />

      <Modal
        title={sheetModalMode === 'create' ? '新建表格' : '重命名表格'}
        open={sheetModalOpen}
        confirmLoading={sheetModalLoading}
        onCancel={closeSheetModal}
        onOk={handleSheetSubmit}
        okText={sheetModalMode === 'create' ? '新建' : '保存'}
        cancelText="取消"
      >
        <Input
          value={sheetName}
          placeholder="请输入表格名称"
          maxLength={40}
          showCount
          onChange={(event) => setSheetName(event.target.value)}
          onPressEnter={handleSheetSubmit}
        />
      </Modal>
    </Layout>
  );
}
