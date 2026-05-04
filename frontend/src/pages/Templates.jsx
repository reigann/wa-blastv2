import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Dropdown, Form, Modal, Row } from "react-bootstrap";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { templatesAPI } from "../services/api";

const variableOptions = ["{name}", "{date}", "{phone}", "{company}"];
const BACKEND_URL = "http://localhost:3001";

function insertAtCursor(text, insertion) {
  return `${text}\n${insertion}`.trim();
}

function toMediaUrl(mediaPath) {
  if (!mediaPath) return null;
  if (mediaPath.startsWith("http")) return mediaPath;
  return `${BACKEND_URL}${mediaPath}`;
}

function isImageType(mediaType = "") {
  return mediaType.startsWith("image/");
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "Marketing",
    content: "",
    link: "",
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("");
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!attachmentFile) {
      setAttachmentPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(attachmentFile);
    setAttachmentPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [attachmentFile]);

  async function loadTemplates() {
    try {
      const response = await templatesAPI.getAll();
      setTemplates(response.data || []);
    } catch (error) {
      setTemplates([]);
      toast.error("Failed to load templates");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", category: "Marketing", content: "", link: "" });
    setAttachmentFile(null);
    setRemoveExistingMedia(false);
    setModalOpen(true);
  }

  function openEdit(template) {
    setEditing(template);
    setForm({
      name: template.name || "",
      category: template.category || "Marketing",
      content: template.content || "",
      link: template.link || "",
    });
    setAttachmentFile(null);
    setRemoveExistingMedia(false);
    setModalOpen(true);
  }

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error("Maximum file size is 16MB");
      event.target.value = "";
      return;
    }

    const allowed =
      /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
    if (!allowed.test(file.name)) {
      toast.error("Unsupported file format");
      event.target.value = "";
      return;
    }

    setAttachmentFile(file);
    setRemoveExistingMedia(false);
  }

  function clearAttachmentSelection() {
    setAttachmentFile(null);
    if (editing?.media_path) {
      setRemoveExistingMedia(true);
    }
  }

  async function saveTemplate() {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Template name and body are required");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("name", form.name.trim());
      payload.append("content", form.content);
      payload.append("category", form.category || "General");
      payload.append("link", form.link || "");
      if (attachmentFile) {
        payload.append("attachment", attachmentFile);
      }
      if (removeExistingMedia && !attachmentFile) {
        payload.append("remove_media", "true");
      }

      if (editing?.id) {
        await templatesAPI.update(editing.id, payload);
      } else {
        await templatesAPI.create(payload);
      }

      toast.success(editing ? "Template updated" : "Template created");
      setModalOpen(false);
      setAttachmentFile(null);
      setRemoveExistingMedia(false);
      await loadTemplates();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save template");
    }
  }

  async function duplicateTemplate(template) {
    try {
      const payload = new FormData();
      payload.append("name", `${template.name} Copy`);
      payload.append("content", template.content || "");
      payload.append("category", template.category || "General");
      payload.append("link", template.link || "");
      await templatesAPI.create(payload);
      toast.success("Template duplicated (without attachment)");
      await loadTemplates();
    } catch (error) {
      toast.error("Duplicate failed");
    }
  }

  async function deleteTemplate(id) {
    try {
      await templatesAPI.delete(id);
      toast.success("Template deleted");
      await loadTemplates();
    } catch (error) {
      toast.error("Delete failed");
    }
  }

  const sorted = useMemo(() => {
    return templates
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at),
      );
  }, [templates]);

  const existingMediaVisible =
    editing?.media_path && !removeExistingMedia && !attachmentFile;

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Templates"
        subtitle="Build reusable WhatsApp messages with dynamic variables"
        actions={[
          <Button key="new" onClick={openCreate}>
            <i className="bi bi-plus-lg me-2" />
            New Template
          </Button>,
        ]}
      />

      {sorted.length === 0 ? (
        <Card className="surface-card">
          <EmptyState
            icon="bi-chat-square-text"
            title="No templates available"
            description="Create your first reusable template to speed up campaign setup"
            ctaLabel="Create Template"
            onCta={openCreate}
          />
        </Card>
      ) : (
        <div className="templates-grid">
          {sorted.map((template) => (
            <Card key={template.id} className="surface-card hover-lift">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <span
                    className="badge"
                    style={{ background: "#e0f2fe", color: "#0c4a6e" }}
                  >
                    {template.category || "General"}
                  </span>
                  <Dropdown align="end">
                    <Dropdown.Toggle
                      variant="light"
                      size="sm"
                      className="border-0"
                    >
                      <i className="bi bi-three-dots" />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => openEdit(template)}>
                        Edit
                      </Dropdown.Item>
                      <Dropdown.Item
                        onClick={() => duplicateTemplate(template)}
                      >
                        Duplicate
                      </Dropdown.Item>
                      <Dropdown.Item
                        className="text-danger"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        Delete
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                <h3 className="mb-2" style={{ fontSize: 16 }}>
                  {template.name}
                </h3>
                <p
                  className="text-secondary mb-3"
                  style={{
                    minHeight: 64,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {template.content}
                </p>

                {template.media_path ? (
                  <div className="mb-3 p-2 rounded border bg-light-subtle">
                    {isImageType(template.media_type || "") ? (
                      <img
                        src={toMediaUrl(template.media_path)}
                        alt={template.media_name || "Template image"}
                        style={{
                          width: "100%",
                          maxHeight: 120,
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <div className="d-flex align-items-center gap-2 small">
                        <i className="bi bi-file-earmark-text" />
                        <span className="text-truncate">
                          {template.media_name || "Document attached"}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="d-flex flex-wrap gap-1 mb-3">
                  {variableOptions
                    .filter((token) =>
                      template.content
                        ?.toLowerCase()
                        .includes(token.replace(/[{}]/g, "").toLowerCase()),
                    )
                    .map((token) => (
                      <span
                        key={`${template.id}-${token}`}
                        className="badge"
                        style={{ background: "#ecfdf3", color: "#166534" }}
                      >
                        {token}
                      </span>
                    ))}
                </div>

                <div className="d-flex justify-content-between small text-secondary">
                  <span>
                    {new Date(
                      template.updated_at || template.created_at || Date.now(),
                    ).toLocaleDateString()}
                  </span>
                  <span>
                    {template.media_path
                      ? "With attachment"
                      : `${(template.id % 9) + 1} uses`}
                  </span>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      <Modal
        show={modalOpen}
        onHide={() => setModalOpen(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editing ? "Edit Template" : "New Template"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={7}>
              <Form.Group className="mb-3">
                <Form.Label>Template Name</Form.Label>
                <Form.Control
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                >
                  <option>Marketing</option>
                  <option>Reminder</option>
                  <option>Alert</option>
                  <option>Transactional</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Message Body</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={7}
                  value={form.content}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      content: event.target.value,
                    }))
                  }
                />
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {variableOptions.map((token) => (
                    <Button
                      key={token}
                      variant="light"
                      size="sm"
                      className="btn-outline-soft"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          content: insertAtCursor(prev.content, token),
                        }))
                      }
                    >
                      {token}
                    </Button>
                  ))}
                </div>
                <small className="text-secondary d-block mt-2">
                  {form.content.length} characters
                </small>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Link Footer (Optional)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="https://example.com or paste your link"
                  value={form.link}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, link: event.target.value }))
                  }
                />
                <small className="text-secondary d-block mt-1">
                  This link will be appended as a footer to the message
                </small>
              </Form.Group>

              <Form.Group className="mb-0">
                <Form.Label>Add Document or Picture</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleAttachmentChange}
                />
                <small className="text-secondary d-block mt-1">
                  Allowed: image, PDF, DOC, XLS, PPT, TXT (max 16MB)
                </small>
              </Form.Group>
            </Col>

            <Col md={5}>
              <div
                className="p-3 rounded-3 border mb-3"
                style={{ background: "#ece5dd" }}
              >
                <div
                  className="rounded-3 bg-white p-3 shadow-sm"
                  style={{ maxWidth: 280 }}
                >
                  <div className="small fw-semibold mb-1">Preview</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {form.content || "Your message preview appears here..."}
                  </div>
                </div>
              </div>

              {attachmentFile ? (
                <div className="p-2 border rounded-3">
                  {isImageType(attachmentFile.type) ? (
                    <img
                      src={attachmentPreviewUrl}
                      alt={attachmentFile.name}
                      style={{
                        width: "100%",
                        maxHeight: 150,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div className="d-flex align-items-center gap-2 small">
                      <i className="bi bi-file-earmark-text" />
                      <span className="text-truncate">
                        {attachmentFile.name}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="light"
                    className="btn-outline-soft btn-sm mt-2"
                    onClick={clearAttachmentSelection}
                  >
                    Remove Attachment
                  </Button>
                </div>
              ) : null}

              {existingMediaVisible ? (
                <div className="p-2 border rounded-3">
                  {isImageType(editing.media_type || "") ? (
                    <img
                      src={toMediaUrl(editing.media_path)}
                      alt={editing.media_name || "Existing attachment"}
                      style={{
                        width: "100%",
                        maxHeight: 150,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div className="d-flex align-items-center gap-2 small">
                      <i className="bi bi-file-earmark-text" />
                      <span className="text-truncate">
                        {editing.media_name || "Document attached"}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="light"
                    className="btn-outline-soft btn-sm mt-2"
                    onClick={clearAttachmentSelection}
                  >
                    Remove Existing Attachment
                  </Button>
                </div>
              ) : null}
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="light"
            className="btn-outline-soft"
            onClick={() => setModalOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={saveTemplate}>Save Template</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
