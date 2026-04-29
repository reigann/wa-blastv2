import { useEffect, useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { contactsAPI } from '../services/api';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { Upload, Plus, Trash2, Users, FileDown, Search } from 'lucide-react';
import { Container, Row, Col, Card, Table, Button, Form, Badge, Modal, Spinner } from 'react-bootstrap';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', phone: '', email: '', group: 'default' },
  });

  useEffect(() => {
    loadContacts();
    loadGroups();
  }, [selectedGroup]);

  useEffect(() => {
    const filtered = contacts.filter(c =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  async function loadContacts() {
    setLoading(true);
    try {
      const r = await contactsAPI.getAll(selectedGroup || undefined);
      setContacts(r.data);
    } catch (error) {
      toast.error('Gagal memuat kontak');
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      const r = await contactsAPI.getGroups();
      setGroups(r.data);
    } catch (error) {
      console.error('Gagal memuat grup:', error);
    }
  }

  async function onSubmitAdd(data) {
    try {
      await contactsAPI.add(data);
      toast.success('Kontak berhasil ditambahkan!');
      setIsAddModalOpen(false);
      reset();
      loadContacts();
      loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal menambahkan kontak');
    }
  }

  async function deleteContact(id) {
    if (!confirm('Hapus kontak ini?')) return;
    try {
      await contactsAPI.delete(id);
      toast.success('Kontak dihapus');
      loadContacts();
      loadGroups();
    } catch (error) {
      toast.error('Gagal menghapus kontak');
    }
  }

  async function deleteAllContacts() {
    if (!confirm(`Hapus semua ${contacts.length} kontak? Ini tidak bisa dibatalkan!`)) {
      return;
    }
    try {
      await contactsAPI.deleteAll(selectedGroup || undefined);
      toast.success('Semua kontak terhapus');
      loadContacts();
      loadGroups();
    } catch (error) {
      toast.error('Gagal menghapus kontak');
    }
  }

  function handleCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const group = prompt('Nama grup untuk kontak ini:', 'default') || 'default';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('group_name', group);

    toast.promise(
      contactsAPI.uploadCSV(formData).then(r => {
        loadContacts();
        loadGroups();
        return r.data;
      }),
      {
        loading: 'Mengupload CSV...',
        success: d => `Berhasil import ${d.imported} kontak (${d.skipped} skip)`,
        error: 'Gagal upload'
      }
    );
  }

  async function exportCSV() {
    try {
      const data = filteredContacts.map(c => ({
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        group: c.group_name
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV diekspor');
    } catch (error) {
      toast.error('Gagal mengekspor CSV');
    }
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4 align-items-center">
        <Col md={8}>
          <h1 className="fw-bold mb-0">
            <Users size={32} className="me-2 text-primary d-inline" />
            Kontak
          </h1>
          <p className="text-muted mt-2">Kelola database kontak WhatsApp Anda</p>
        </Col>
        <Col md={4} className="text-md-end">
          <div className="d-flex gap-2 justify-content-md-end flex-wrap">
            <Button
              variant="outline-primary"
              onClick={() => fileRef.current?.click()}
              size="sm"
              className="d-flex align-items-center gap-2"
            >
              <Upload size={16} /> Import CSV
            </Button>
            <Button
              variant="outline-secondary"
              onClick={exportCSV}
              disabled={contacts.length === 0}
              size="sm"
              className="d-flex align-items-center gap-2"
            >
              <FileDown size={16} /> Export
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              size="sm"
              className="d-flex align-items-center gap-2"
            >
              <Plus size={16} /> Tambah Kontak
            </Button>
          </div>
        </Col>
      </Row>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="d-none"
        onChange={handleCSVUpload}
      />

      {/* Search & Filter */}
      <Row className="mb-4 g-3">
        <Col md={6}>
          <div className="position-relative">
            <Search className="position-absolute" size={18} style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
            <Form.Control
              type="text"
              placeholder="Cari berdasarkan nama atau nomor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
        </Col>
        <Col md={6}>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant={selectedGroup === '' ? 'primary' : 'outline-secondary'}
              size="sm"
              onClick={() => setSelectedGroup('')}
            >
              Semua ({contacts.length})
            </Button>
            {groups.map(g => (
              <Button
                key={g.group_name}
                variant={selectedGroup === g.group_name ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setSelectedGroup(g.group_name)}
              >
                {g.group_name} ({g.count})
              </Button>
            ))}
          </div>
        </Col>
      </Row>

      {/* Contacts Table */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light border-0 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">
                <Users size={18} className="me-2 text-primary d-inline" />
                Daftar Kontak
              </h6>
              {contacts.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={deleteAllContacts}
                  className="d-flex align-items-center gap-2"
                >
                  <Trash2 size={14} /> Hapus Semua
                </Button>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" className="mb-2" />
                  <p className="text-muted">Memuat kontak...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-5">
                  <Users size={40} className="text-muted mb-3 d-block" />
                  <p className="text-muted mb-3">Belum ada kontak</p>
                  <Button onClick={() => setIsAddModalOpen(true)}>
                    Tambah Kontak Pertama
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead>
                      <tr className="border-top border-bottom">
                        <th>Nama</th>
                        <th>Nomor</th>
                        <th>Email</th>
                        <th>Grup</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td className="fw-medium">{contact.name}</td>
                          <td className="font-monospace">{contact.phone}</td>
                          <td className="text-muted">{contact.email || '-'}</td>
                          <td>
                            <Badge bg="primary">{contact.group_name}</Badge>
                          </td>
                          <td>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => deleteContact(contact.id)}
                              className="text-danger p-0"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Add Contact Modal */}
      <Modal show={isAddModalOpen} onHide={() => { setIsAddModalOpen(false); reset(); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Tambah Kontak Baru</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-3">
            <Form.Group className="mb-3">
              <Form.Label>Nama Lengkap <span className="text-danger">*</span></Form.Label>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Nama wajib diisi' }}
                render={({ field }) => (
                  <>
                    <Form.Control {...field} placeholder="Nama kontak" isInvalid={!!errors.name} />
                    <Form.Control.Feedback type="invalid">
                      {errors.name?.message}
                    </Form.Control.Feedback>
                  </>
                )}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nomor Telepon <span className="text-danger">*</span></Form.Label>
              <Controller
                name="phone"
                control={control}
                rules={{ required: 'Nomor telepon wajib diisi' }}
                render={({ field }) => (
                  <>
                    <Form.Control {...field} placeholder="+6281234567890" isInvalid={!!errors.phone} />
                    <Form.Text className="text-muted">
                      Contoh: +6281234567890 atau 081234567890
                    </Form.Text>
                    <Form.Control.Feedback type="invalid">
                      {errors.phone?.message}
                    </Form.Control.Feedback>
                  </>
                )}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email (Opsional)</Form.Label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Form.Control {...field} type="email" placeholder="email@example.com" isInvalid={!!errors.email} />
                )}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Grup <span className="text-danger">*</span></Form.Label>
              <Controller
                name="group"
                control={control}
                rules={{ required: 'Pilih grup' }}
                render={({ field }) => (
                  <>
                    <Form.Select {...field} isInvalid={!!errors.group}>
                      <option value="default">Default</option>
                      {groups.map(g => (
                        <option key={g.group_name} value={g.group_name}>{g.group_name}</option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errors.group?.message}
                    </Form.Control.Feedback>
                  </>
                )}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); reset(); }}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmitAdd)} disabled={isSubmitting}>
            {isSubmitting ? <><Spinner size="sm" className="me-2" />Loading...</> : 'Tambahkan Kontak'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
