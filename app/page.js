"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import RichTextEditor from "@/components/RichTextEditor";
import { useDispatch, useSelector } from "react-redux";
import {
  saveDraft,
  saveEditedDraft,
  setIsEditingDraft as setReduxIsEditingDraft,
  saveSelectedContacts,
  setIsBulkEmail,
  clearDraft,
} from "@/store/emailDraftSlice";
import {
  FiCheck,
  FiEdit,
  FiFileText,
  FiGrid,
  FiInfo,
  FiList,
  FiLogOut,
  FiMail,
  FiPlus,
  FiSave,
  FiSearch,
  FiSend,
  FiSettings,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi";

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildWordBoundaryRegex = (value) => {
  if (!value) return null;
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
};

export default function HomePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const reduxDraft = useSelector((state) => state.emailDraft.draft);
  const reduxEditedDraft = useSelector((state) => state.emailDraft.editedDraft);
  const reduxIsEditingDraft = useSelector((state) => state.emailDraft.isEditingDraft);
  const reduxSelectedContacts = useSelector((state) => state.emailDraft.selectedContacts);
  const reduxIsBulkEmail = useSelector((state) => state.emailDraft.isBulkEmail);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Contact state
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    identification: {
      verified: false,
      active: true,
      primary: false,
    },
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);

  // Excel upload and spreadsheet state
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [editedContacts, setEditedContacts] = useState([]);
  const [newRow, setNewRow] = useState({
    name: "",
    email: "",
    identification: { verified: false, active: true, primary: false },
  });
  const [saving, setSaving] = useState(false);

  // Selected contacts for email
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState("");

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const query = contactSearch.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [contactSearch, contacts]);

  const visibleContactsSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedContacts.includes(contact._id));

  // AI Chat Assistant state
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm here to help you write high-impact marketing emails. Whether it's a discount, new service, or brand update.",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [sendStatus, setSendStatus] = useState("");
  const [smtpConfigError, setSmtpConfigError] = useState(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraft, setEditedDraft] = useState(null);
  const [isRestoringFromRedux, setIsRestoringFromRedux] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    contact: null,
    mode: "list",
    selectedIds: [],
    loading: false,
  });
  const storageKey = useMemo(
    () => (user ? `ai-email-tool:contacts:${user._id || user.email}` : null),
    [user]
  );

  const loadContactsFromStorage = useCallback(() => {
    if (typeof window === "undefined" || !storageKey) return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to parse contacts from storage", err);
      return [];
    }
  }, [storageKey]);

  const persistContacts = useCallback(
    (list) => {
      if (typeof window !== "undefined" && storageKey) {
        window.localStorage.setItem(storageKey, JSON.stringify(list));
      }
      setContacts(list);
    },
    [storageKey]
  );

  const clearContactSelection = useCallback(() => {
    setSelectedContacts([]);
  }, []);

  // Try to auto-match a contact from the user's command so we can treat it as selected.
  const findContactFromMessage = useCallback(
    (message) => {
      if (!message?.trim()) return null;
      const lowerMessage = message.toLowerCase();
      for (const contact of contacts) {
        const email = contact.email?.trim().toLowerCase();
        if (email && lowerMessage.includes(email)) {
          return contact;
        }

        const name = contact.name?.trim();
        if (!name) continue;
        const normalizedMessage = message;
        const fullNameRegex = buildWordBoundaryRegex(name);
        if (fullNameRegex?.test(normalizedMessage)) {
          return contact;
        }

        const nameParts = name.split(/\s+/).filter(Boolean);
        if (nameParts.length > 0) {
          const firstName = nameParts[0];
          if (firstName.length >= 2) {
            const firstNameRegex = buildWordBoundaryRegex(firstName);
            if (firstNameRegex?.test(normalizedMessage)) {
              return contact;
            }
          }
        }
      }
      return null;
    },
    [contacts]
  );

  // Load contacts
  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const stored = loadContactsFromStorage();
      setContacts(stored);
      return stored;
    } catch (err) {
      console.error("Failed to load contacts", err);
      return [];
    } finally {
      setContactsLoading(false);
    }
  }, [loadContactsFromStorage]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setLoading(false);
      } catch (err) {
        console.error(err);
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user, fetchContacts]);

  useEffect(() => {
      setEditedContacts(contacts.map((contact) => ({ ...contact })));
  }, [contacts, showSpreadsheet]);

  // Clear selections when contacts change
  useEffect(() => {
    setSelectedContacts([]);
  }, [contacts]);

  // Restore draft from Redux when coming back from navigation
  useEffect(() => {
    if (reduxDraft && !currentDraft && !isRestoringFromRedux) {
      setIsRestoringFromRedux(true);
      setCurrentDraft(reduxDraft);
      if (reduxEditedDraft) {
        setEditedDraft(reduxEditedDraft);
      }
      setIsEditingDraft(reduxIsEditingDraft);
      if (reduxSelectedContacts && reduxSelectedContacts.length > 0) {
        setSelectedContacts(reduxSelectedContacts);
      }
      // Reset flag after state updates complete
      setTimeout(() => setIsRestoringFromRedux(false), 100);
    }
  }, [reduxDraft]); // Restore when reduxDraft is available and currentDraft is null

  // Save draft to Redux whenever it changes
  useEffect(() => {
    if (currentDraft && !isRestoringFromRedux) {
      dispatch(saveDraft(currentDraft));
      if (selectedContacts.length > 0) {
        dispatch(saveSelectedContacts(selectedContacts));
        dispatch(setIsBulkEmail(selectedContacts.length > 1));
      }
    }
  }, [currentDraft, selectedContacts, dispatch, isRestoringFromRedux]);

  // Save edited draft to Redux
  useEffect(() => {
    if (editedDraft && !isRestoringFromRedux) {
      dispatch(saveEditedDraft(editedDraft));
    }
  }, [editedDraft, dispatch, isRestoringFromRedux]);

  // Save editing state to Redux
  useEffect(() => {
    if (!isRestoringFromRedux) {
      dispatch(setReduxIsEditingDraft(isEditingDraft));
    }
  }, [isEditingDraft, dispatch, isRestoringFromRedux]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setIsEditingDraft(false);
    setEditedDraft(null);
  }, [currentDraft]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleContactChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith("identification.")) {
      const field = name.split(".")[1];
      setContactForm((prev) => ({
        ...prev,
        identification: {
          ...prev.identification,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else {
      setContactForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError("");
    setContactLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactForm.email)) {
        setContactError("Invalid email format");
        return;
      }

      const newContact = {
        _id: generateId(),
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        identification: contactForm.identification || {
          verified: false,
          active: true,
          primary: false,
        },
      };

      const updatedContacts = [...contacts, newContact];
      persistContacts(updatedContacts);
        setContactForm({
          name: "",
          email: "",
          identification: { verified: false, active: true, primary: false },
        });
        setShowContactForm(false);
    } catch (err) {
      console.error(err);
      setContactError("Failed to add contact");
    } finally {
      setContactLoading(false);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      const updatedContacts = contacts.filter((contact) => contact._id !== id);
      persistContacts(updatedContacts);
      setSelectedContacts((prev) => prev.filter((contactId) => contactId !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDeleteContacts = async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
      const idsSet = new Set(ids);
      const updatedContacts = contacts.filter((contact) => !idsSet.has(contact._id));
      persistContacts(updatedContacts);
      setSelectedContacts((prev) => prev.filter((id) => !idsSet.has(id)));
      setUploadSuccess(`Deleted ${ids.length} contact${ids.length !== 1 ? "s" : ""}.`);
      setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to delete selected contacts");
      setTimeout(() => setUploadError(""), 3000);
    }
  };

  // Bulk email handlers
  const handleSelectContact = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    const sourceList =
      !showSpreadsheet && contactSearch.trim() ? filteredContacts : contacts;
    if (sourceList.length === 0) return;

    const allSelected = sourceList.every((contact) =>
        selectedContacts.includes(contact._id)
      );

    if (allSelected) {
      setSelectedContacts((prev) =>
        prev.filter(
          (contactId) => !sourceList.some((contact) => contact._id === contactId)
        )
      );
        } else {
      setSelectedContacts((prev) => {
        const newSelection = new Set(prev);
        sourceList.forEach((contact) => newSelection.add(contact._id));
        return Array.from(newSelection);
      });
    }
  };


  // Excel upload handler
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setUploadError("Please upload a valid Excel file (.xlsx or .xls)");
      e.target.value = "";
      return;
    }

    setUploadLoading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const existingEmails = new Set(contacts.map((contact) => contact.email.toLowerCase()));
      const importedContacts = [];

      rows.forEach((row) => {
        const name =
          row.Name ||
          row.name ||
          row["Full Name"] ||
          row["full name"] ||
          row["Employee Name"] ||
          "";
        const email =
          row.Email ||
          row.email ||
          row["Email Address"] ||
          row["email address"] ||
          "";

        if (!name || !email) return;
        const trimmedEmail = String(email).trim();
        if (!emailRegex.test(trimmedEmail)) return;
        if (existingEmails.has(trimmedEmail.toLowerCase())) return;

        importedContacts.push({
          _id: generateId(),
          name: String(name).trim(),
          email: trimmedEmail,
          identification: { verified: false, active: true, primary: false },
        });
        existingEmails.add(trimmedEmail.toLowerCase());
      });

      if (importedContacts.length === 0) {
        setUploadError("No new contacts found in the uploaded file.");
      } else {
        persistContacts([...contacts, ...importedContacts]);
        setUploadSuccess(
          `Imported ${importedContacts.length} contact${importedContacts.length !== 1 ? "s" : ""} successfully!`
        );
        setTimeout(() => setUploadSuccess(""), 5000);
      }
    } catch (err) {
      console.error(err);
      setUploadError("Failed to process Excel file");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  };

  // Spreadsheet handlers
  const handleEditRow = (id) => {
    setEditingRow(id);
  };

  const handleSaveRow = async (id) => {
    const contact = editedContacts.find((c) => c._id === id);
    if (!contact) return;

    // Validate
    if (!contact.name || !contact.email) {
      setUploadError("Name and email are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      setUploadError("Invalid email format");
      return;
    }

    setSaving(true);
    setUploadError("");

    try {
      const updatedContacts = contacts.map((existing) =>
        existing._id === id
          ? {
              ...existing,
          name: contact.name,
          email: contact.email,
              identification:
                contact.identification || {
            verified: false,
            active: true,
            primary: false,
          },
            }
          : existing
      );
      persistContacts(updatedContacts);
        setEditingRow(null);
        setUploadSuccess("Contact updated successfully!");
        setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to update contact");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = (id) => {
    // Reset to original contact data
    const original = contacts.find((c) => c._id === id);
    if (original) {
      setEditedContacts((prev) =>
        prev.map((c) => (c._id === id ? { ...original } : c))
      );
    }
    setEditingRow(null);
  };

  const handleCellChange = (id, field, value) => {
    setEditedContacts((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleAddNewRow = () => {
    setNewRow({
      name: "",
      email: "",
      identification: { verified: false, active: true, primary: false },
    });
    setEditingRow("new");
  };

  const handleSaveNewRow = async () => {
    if (!newRow.name || !newRow.email) {
      setUploadError("Name and email are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRow.email)) {
      setUploadError("Invalid email format");
      return;
    }

    setSaving(true);
    setUploadError("");

    try {
      const contactToAdd = {
        _id: generateId(),
        name: newRow.name.trim(),
        email: newRow.email.trim(),
        identification: newRow.identification || {
          verified: false,
          active: true,
          primary: false,
        },
      };
      persistContacts([...contacts, contactToAdd]);
        setEditingRow(null);
        setNewRow({
          name: "",
          email: "",
          identification: { verified: false, active: true, primary: false },
        });
        setUploadSuccess("Contact added successfully!");
        setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (id) => {
    setSaving(true);
    try {
      const updatedContacts = contacts.filter((contact) => contact._id !== id);
      persistContacts(updatedContacts);
      setSelectedContacts((prev) => prev.filter((contactId) => contactId !== id));
        setUploadSuccess("Contact deleted successfully!");
        setTimeout(() => setUploadSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to delete contact");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (contact, mode = "list", ids = []) => {
    setDeleteDialog({
      open: true,
      contact,
      mode,
      selectedIds: ids,
      loading: false,
    });
  };

  const closeDeleteDialog = () =>
    setDeleteDialog({
      open: false,
      contact: null,
      mode: "list",
      selectedIds: [],
      loading: false,
    });

  const confirmDeleteContact = async () => {
    setDeleteDialog((prev) => ({ ...prev, loading: true }));

    try {
      if (deleteDialog.mode === "bulk") {
        await handleBulkDeleteContacts(deleteDialog.selectedIds || []);
        closeDeleteDialog();
        return;
      }

      const contactId = deleteDialog.contact?._id;
      if (!contactId) {
        closeDeleteDialog();
        return;
      }

      if (deleteDialog.mode === "sheet") {
        await handleDeleteRow(contactId);
      } else {
        await handleDeleteContact(contactId);
      }
      closeDeleteDialog();
    } catch (err) {
      console.error(err);
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setCurrentDraft(null);
    setSendStatus("");

    // Check if contacts are selected (or implicitly referenced in the message)
    let selectedContactDetails = contacts.filter((contact) =>
      selectedContacts.includes(contact._id)
    );
    if (selectedContactDetails.length === 0 && selectedContacts.length === 0) {
      const implicitContact = findContactFromMessage(userMessage);
      if (implicitContact) {
        selectedContactDetails = [implicitContact];
        setSelectedContacts([implicitContact._id]);
      }
    }
    const hasSelectedContacts = selectedContactDetails.length > 0;
    const isMultiRecipient = selectedContactDetails.length > 1;

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    setIsGenerating(true);

    try {
      // Add thinking message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: hasSelectedContacts
            ? `Generating email for ${selectedContactDetails.length} selected contact${selectedContactDetails.length !== 1 ? "s" : ""}...`
            : "Let me generate that email for you...",
          isLoading: true,
          timestamp: new Date(),
        },
      ]);

      // For bulk emails, pass selected contacts to the API
      const requestBody = hasSelectedContacts
        ? {
            command: userMessage,
            selectedContacts: selectedContactDetails.map((c) => ({
              _id: c._id,
              name: c.name,
              email: c.email,
              role: c.role || null,
              department: c.department || null,
            })),
          }
        : { command: userMessage };

      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      // Remove loading message
      setMessages((prev) => prev.filter((msg) => !msg.isLoading));

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I encountered an issue: ${
              data.error || "Failed to generate email"
            }. Please try again or check if the contact name is correct.`,
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } else {
        // Add bulk email info to draft
        const draftData = {
          ...data,
          isBulk: isMultiRecipient,
          selectedContacts: hasSelectedContacts ? selectedContactDetails : null,
        };

        setCurrentDraft(draftData);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: isMultiRecipient
              ? `I've prepared a group email for ${selectedContactDetails.length} contacts (no individual names in the template). Each person will get a personalized greeting when sent. Please review below.`
              : hasSelectedContacts
                ? `I've prepared an email for ${data.employee?.name || selectedContactDetails[0]?.name || "the recipient"}. Please review it below and click "Send Email" when ready.`
                : `I've prepared an email for ${
                    data.employee?.name || data.contact?.name || "the recipient"
                  }. Please review it below and click "Send Email" when ready.`,
            timestamp: new Date(),
            draft: draftData,
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.isLoading);
        return [
          ...filtered,
          {
            role: "assistant",
            content: "I'm sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
            isError: true,
          },
        ];
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditDraft = () => {
    setEditedDraft({
      subject: currentDraft.subject,
      body_html: currentDraft.body_html,
    });
    setIsEditingDraft(true);
  };

  const handleSaveDraftEdit = () => {
    if (!editedDraft || !editedDraft.subject.trim() || !editedDraft.body_html.trim()) {
      return;
    }
    setCurrentDraft({
      ...currentDraft,
      subject: editedDraft.subject,
      body_html: editedDraft.body_html,
    });
    setIsEditingDraft(false);
    setEditedDraft(null);
  };

  const handleCancelDraftEdit = () => {
    setIsEditingDraft(false);
    setEditedDraft(null);
  };

  const handleCancelDraft = useCallback(() => {
    setCurrentDraft(null);
    setSendStatus("");
    clearContactSelection();
    dispatch(clearDraft());
  }, [clearContactSelection, dispatch]);

  const handleBodyEditorChange = (html) => {
    setEditedDraft((prev) =>
      prev ? { ...prev, body_html: html } : prev
    );
  };

  const handleSendEmail = async () => {
    if (!currentDraft) return;
    setSendStatus("Sending...");
    setSmtpConfigError(null);

    // Check if this is a bulk email
    if (
      currentDraft.isBulk &&
      currentDraft.selectedContacts &&
      currentDraft.selectedContacts.length > 1
    ) {
      const personalizeGreeting = (html, recipientName) =>
        html.replace(
          /(Dear|Hello|Hi|Greetings)(\s+[^<\r\n,]+)?,?\s*/i,
          `Dear ${recipientName}, `
        );

      // Send to multiple recipients
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const contact of currentDraft.selectedContacts) {
        try {
          const recipientName =
            contact.name?.trim() ||
            contact.email?.trim() ||
            "Recipient";
          const personalizedBody = personalizeGreeting(
            currentDraft.body_html,
            recipientName
          );

          const payload = {
            to: contact.email,
            subject: currentDraft.subject,
            body_html: personalizedBody,
            recipientName,
          };

          const res = await fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) {
            if (data?.needsEmailConfig) {
              setSmtpConfigError({
                message:
                  data.error ||
                  "SMTP configuration is incomplete. Save the required fields before sending.",
                missingFields: data.missingFields || [],
                setupPath: data.setupPath || "/email-settings",
              });
              setSendStatus("SMTP configuration incomplete");
              return;
            }
            failCount++;
            errors.push(`${recipientName}: ${data.error || "Failed"}`);
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(err);
          failCount++;
          errors.push(`${contact.name || contact.email || "Recipient"}: Failed to send`);
        }
      }

      // Update status
      if (successCount === currentDraft.selectedContacts.length) {
        setSendStatus(`All emails sent successfully! (${successCount} sent)`);
        setCurrentDraft(null);
        clearContactSelection();
        dispatch(clearDraft());
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Great! I've successfully sent emails to ${successCount} contact${successCount !== 1 ? "s" : ""}. Is there anything else I can help you with?`,
            timestamp: new Date(),
          },
        ]);
      } else {
        setSendStatus(
          `Sent: ${successCount}, Failed: ${failCount}. ${errors.slice(0, 3).join("; ")}`
        );
      }
    } else {
      // Send to single recipient
      const singleContact = currentDraft.selectedContacts?.[0];
      const recipientName =
        currentDraft.employee?.name ||
        singleContact?.name ||
        currentDraft.contact?.name ||
        currentDraft.toName ||
        "Recipient";

    const payload = {
        to:
          currentDraft.employee?.email ||
          singleContact?.email ||
          currentDraft.contact?.email ||
          currentDraft.to,
      subject: currentDraft.subject,
      body_html: currentDraft.body_html,
        recipientName,
    };

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.needsEmailConfig) {
          setSmtpConfigError({
            message:
              data.error ||
              "SMTP configuration is incomplete. Save the required fields before sending.",
            missingFields: data.missingFields || [],
            setupPath: data.setupPath || "/email-settings",
          });
          setSendStatus("SMTP configuration incomplete");
          return;
        }
        setSmtpConfigError(null);
        setSendStatus(`Failed: ${data.error || "Unknown error"}`);
      } else {
        setSmtpConfigError(null);
        setSendStatus("Email sent successfully!");
        setCurrentDraft(null);
        clearContactSelection();
        dispatch(clearDraft());
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Great! The email has been sent successfully to ${
              currentDraft.employee?.email ||
              currentDraft.contact?.email ||
              currentDraft.to
            }. Is there anything else I can help you with?`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setSendStatus("Failed to send email");
      }
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-stone-950 flex items-center justify-center text-white">
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.4),_transparent_60%)]" aria-hidden="true"></div>
        <div className="relative z-10 text-center">
          <div className="w-14 h-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-stone-950 text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,_rgba(5,150,105,0.28),_transparent_55%)]" aria-hidden="true"></div>
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.18),_transparent_45%)]" aria-hidden="true"></div>
      <div className="absolute inset-0 bg-[length:24px_24px] bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)]" aria-hidden="true"></div>
      <div className="relative z-10">
      {/* Header */}
      <header className="header-bar sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <HiOutlineSparkles className="text-white text-lg sm:text-xl" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-violet-600 bg-clip-text text-transparent">
                    AI Email Automation
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 flex items-center gap-1">
                    <FiMail className="text-xs" />
                    <span>Professional email management for your team</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <span className="text-xs text-gray-600 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 px-3 sm:px-4 py-1.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1.5">
                <FiUsers className="text-emerald-600" />
                <span>{contacts.length} Contact{contacts.length !== 1 ? "s" : ""}</span>
              </span>
              {user && (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                    <FiUser className="text-violet-600 text-sm" />
                    <span className="text-sm text-gray-700 font-medium">{user.name}</span>
                  </div>
                  <Link
                    href="/settings"
                    className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-all min-h-[44px] sm:min-h-0 flex items-center gap-2 border border-emerald-200 hover:border-emerald-300 hover:shadow-sm"
                    title="Settings"
                  >
                    <FiSettings className="text-base" />
                    <span className="hidden sm:inline">Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-red-50 active:bg-red-100 transition-all min-h-[44px] sm:min-h-0 flex items-center gap-2 border border-red-200 hover:border-red-300 hover:shadow-sm"
                    title="Logout"
                  >
                    <FiLogOut className="text-base" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="bg-white/90 backdrop-blur border border-white/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg">
            <p className="text-xs uppercase tracking-wider text-slate-500">Contacts</p>
            <p className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-2">{contacts.length}</p>
            <p className="hidden sm:block text-xs text-slate-500 mt-1">
              {filteredContacts.length !== contacts.length
                ? `${filteredContacts.length} visible with current filter`
                : "Synced from your workplace records"}
            </p>
          </div>
          <div className="bg-white/90 backdrop-blur border border-white/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg">
            <p className="text-xs uppercase tracking-wider text-slate-500">Selected</p>
            <p className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-2">{selectedContacts.length}</p>
            <p className="hidden sm:block text-xs text-slate-500 mt-1">
              {selectedContacts.length > 0
                ? "Ready for bulk personalization"
                : "Select contacts to activate bulk send"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-violet-600 text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl">
            <p className="text-xs uppercase tracking-wider opacity-80">Draft Status</p>
            <p className="text-lg sm:text-2xl font-semibold mt-2">{currentDraft ? "Draft Ready" : "Awaiting prompt"}</p>
            <p className="hidden sm:block text-xs opacity-80 mt-1 line-clamp-2">
              {currentDraft ? currentDraft.subject || "Personalized email prepared" : "Describe what you'd like to send"}
            </p>
          </div>
          <div className="bg-white/90 backdrop-blur border border-white/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Assistant</p>
              <p className="text-lg sm:text-2xl font-semibold text-slate-900 mt-2">
                {isGenerating ? "Crafting emails..." : "Standing by"}
              </p>
            </div>
            <p className="hidden sm:block text-xs text-slate-500 mt-1">
              {messages[messages.length - 1]?.role === "assistant"
                ? messages[messages.length - 1].content.slice(0, 60)
                : "Ask anything about your team communications"}
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Sidebar - Contact Management */}
          <div className="lg:col-span-1 space-y-3 sm:space-y-4 order-1">
            {/* Add Contact Card */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-3 sm:p-5 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                  Contact Management
                </h2>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => setShowSpreadsheet(!showSpreadsheet)}
                    className="flex-1 sm:flex-initial text-violet-600 hover:text-violet-700 text-xs sm:text-sm font-medium px-3 py-2 sm:py-1.5 rounded-lg hover:bg-violet-50 active:bg-violet-100 transition-colors min-h-[44px] sm:min-h-0"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {showSpreadsheet ? <FiList /> : <FiGrid />}
                      {showSpreadsheet ? "List" : "Sheet"}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowContactForm(!showContactForm)}
                    className="flex-1 sm:flex-initial text-emerald-600 hover:text-emerald-700 text-xs sm:text-sm font-medium px-3 py-2 sm:py-1.5 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors min-h-[44px] sm:min-h-0"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {showContactForm ? <FiX /> : <FiPlus />}
                      {showContactForm ? "Cancel" : "Add"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <label className="text-xs sm:text-sm font-medium text-gray-600 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-50 text-violet-600 text-xs">
                    <FiSearch />
                  </span>
                  Find a teammate
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/70"
                  />
                  {contactSearch && (
                    <button
                      type="button"
                      onClick={() => setContactSearch("")}
                      className="absolute inset-y-0 right-3 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Showing {filteredContacts.length} of {contacts.length} contacts
                </p>
              </div>

              {/* Excel Upload Section */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Upload Excel Sheet
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      disabled={uploadLoading}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center gap-2 px-3 sm:px-4 py-3 sm:py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 active:bg-emerald-100 transition-colors min-h-[44px]">
                      <span className="text-xs sm:text-sm text-gray-600 font-medium">
                        {uploadLoading
                          ? "Uploading..."
                          : (
                            <span className="inline-flex items-center gap-2">
                              <FiUploadCloud />
                              Choose Excel File
                            </span>
                          )}
                      </span>
                    </div>
                  </label>
                </div>
                {uploadError && (
                  <p className="text-xs sm:text-sm text-red-600 bg-red-50 p-2.5 rounded-lg mt-2 border border-red-200">
                    {uploadError}
                  </p>
                )}
                {uploadSuccess && (
                  <p className="text-xs sm:text-sm text-green-600 bg-green-50 p-2.5 rounded-lg mt-2 border border-green-200">
                    {uploadSuccess}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Excel should have columns: Name, Email
                </p>
              </div>

              {showContactForm && (
                <form
                  onSubmit={handleContactSubmit}
                  className="space-y-3 animate-fadeIn"
                >
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    name="name"
                    placeholder="Full Name *"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    required
                    minLength={2}
                  />
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    name="email"
                    placeholder="Email Address *"
                    type="email"
                    value={contactForm.email}
                    onChange={handleContactChange}
                    required
                  />
                  {contactError && (
                    <p className="text-xs sm:text-sm text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                      {contactError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={contactLoading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md min-h-[44px] text-sm sm:text-base"
                  >
                    {contactLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Adding...
                      </span>
                    ) : (
                      "Add Contact"
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Contacts List or Spreadsheet */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-3 sm:p-5 border border-gray-100">
              <div className="flex flex-col gap-3 mb-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {!showSpreadsheet && contacts.length > 0 && (
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleContactsSelected && filteredContacts.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="ml-2 text-xs sm:text-sm text-gray-600 font-medium">
                        Select All
                      </span>
                    </label>
                  )}
                  {selectedContacts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full">
                        {selectedContacts.length} selected
                      </span>
                      <button
                        onClick={() =>
                          openDeleteDialog(null, "bulk", [...selectedContacts])
                        }
                        className="text-xs sm:text-sm text-red-600 font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                      >
                        Delete Selected
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-800">
                    Contacts ({filteredContacts.length}/{contacts.length})
                </h3>
                {showSpreadsheet && (
                  <button
                    onClick={handleAddNewRow}
                    disabled={editingRow === "new"}
                      className="text-xs sm:text-sm bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[36px] sm:min-h-0 font-medium shadow-sm"
                  >
                    <span className="inline-flex items-center gap-1">
                      <FiPlus />
                      Add Row
                    </span>
                  </button>
                )}
                </div>
              </div>

              {contactsLoading && !showSpreadsheet ? (
                <div className="space-y-2 sm:space-y-2.5 max-h-[400px] sm:max-h-96 overflow-y-auto">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`skeleton-${idx}`}
                      className="border border-gray-200 rounded-lg p-3 sm:p-3.5 animate-pulse"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          <div className="flex gap-2 mt-1.5">
                            <div className="h-5 bg-gray-200 rounded w-16"></div>
                            <div className="h-5 bg-gray-200 rounded w-14"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showSpreadsheet && filteredContacts.length === 0 ? (
                contactSearch ? (
                  <div className="text-center py-10">
                    <FiSearch className="mx-auto mb-3 text-5xl sm:text-6xl text-gray-300" />
                    <p className="text-sm sm:text-base text-gray-500 px-2">
                      No contacts match "{contactSearch}".
                      <br />
                      Try a different name or clear the search filter.
                    </p>
                  </div>
                ) : (
                <div className="text-center py-8 sm:py-10">
                  <FiUsers className="mx-auto mb-3 text-5xl sm:text-6xl text-gray-300" />
                  <p className="text-sm sm:text-base text-gray-500 px-2">
                    No contacts yet.
                    <br />
                    Add your first contact above or upload an Excel sheet.
                  </p>
                </div>
                )
              ) : showSpreadsheet ? (
                /* Spreadsheet View */
                <div className="overflow-x-auto max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto -mx-1 px-1">
                  <table className="w-full text-xs sm:text-sm border-collapse min-w-[500px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700 w-10">
                          <input
                            type="checkbox"
                            checked={selectedContacts.length === editedContacts.length && editedContacts.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">
                          Email
                        </th>
                        <th className="border border-gray-300 px-2 sm:px-3 py-2 text-left font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* New Row Form */}
                      {editingRow === "new" && (
                        <tr className="bg-green-50">
                          <td className="border border-gray-300 px-2 sm:px-3 py-2"></td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            <input
                              type="text"
                              value={newRow.name}
                              onChange={(e) =>
                                setNewRow({ ...newRow, name: e.target.value })
                              }
                              placeholder="Name *"
                              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px] sm:min-h-0"
                            />
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            <input
                              type="email"
                              value={newRow.email}
                              onChange={(e) =>
                                setNewRow({ ...newRow, email: e.target.value })
                              }
                              placeholder="Email *"
                              className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px] sm:min-h-0"
                            />
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            <div className="flex gap-1">
                               <button
                                 onClick={handleSaveNewRow}
                                 disabled={saving}
                                 aria-label="Save new contact"
                                 title="Save new contact"
                                className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                              >
                                <FiCheck />
                              </button>
                               <button
                                 onClick={() => {
                                  setEditingRow(null);
                                  setNewRow({
                                    name: "",
                                    email: "",
                                    identification: {
                                      verified: false,
                                      active: true,
                                      primary: false,
                                    },
                                  });
                                 }}
                                 aria-label="Cancel new contact"
                                 title="Cancel"
                                className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-gray-500 text-white text-xs rounded-lg hover:bg-gray-600 active:bg-gray-700 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                              >
                                <FiX />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Existing Rows */}
                      {editedContacts.map((contact) => (
                        <tr
                          key={contact._id}
                          className={
                            editingRow === contact._id
                              ? "bg-emerald-50"
                              : selectedContacts.includes(contact._id)
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : "hover:bg-gray-50"
                          }
                        >
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                           <input
                             type="checkbox"
                             checked={selectedContacts.includes(contact._id)}
                             aria-label={`Select ${contact.name}`}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectContact(contact._id);
                              }}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            {editingRow === contact._id ? (
                              <input
                                type="text"
                                value={contact.name}
                                onChange={(e) =>
                                  handleCellChange(
                                    contact._id,
                                    "name",
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px] sm:min-h-0"
                              />
                            ) : (
                              <span className="text-gray-900 text-left w-full text-xs sm:text-sm font-medium">
                                {contact.name}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            {editingRow === contact._id ? (
                              <input
                                type="email"
                                value={contact.email}
                                onChange={(e) =>
                                  handleCellChange(
                                    contact._id,
                                    "email",
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-2 sm:py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[36px] sm:min-h-0"
                              />
                            ) : (
                              <span className="text-gray-600 text-xs sm:text-sm break-all">
                                {contact.email}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-3 py-2">
                            {editingRow === contact._id ? (
                              <div className="flex gap-1">
                                 <button
                                   onClick={() => handleSaveRow(contact._id)}
                                   disabled={saving}
                                   aria-label={`Save ${contact.name}`}
                                   title="Save changes"
                                  className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <FiCheck />
                                </button>
                                 <button
                                   onClick={() => handleCancelEdit(contact._id)}
                                   aria-label={`Cancel editing ${contact.name}`}
                                   title="Cancel"
                                  className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-gray-500 text-white text-xs rounded-lg hover:bg-gray-600 active:bg-gray-700 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <FiX />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                 <button
                                   onClick={() => handleEditRow(contact._id)}
                                   aria-label={`Edit ${contact.name}`}
                                   title="Edit contact"
                                  className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <FiEdit />
                                </button>
                                 <button
                                   onClick={() => openDeleteDialog(contact, "sheet")}
                                   aria-label={`Delete ${contact.name}`}
                                   title="Delete contact"
                                  className="px-2 sm:px-2.5 py-1.5 sm:py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editedContacts.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No contacts in spreadsheet. Add one using the "+ Add Row"
                      button.
                    </div>
                  )}
                </div>
              ) : (
                /* List View */
                <div
                  className="space-y-2 sm:space-y-2.5 h-[320px] sm:h-[360px] overflow-y-auto -mx-1 px-1 pr-2"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact._id}
                        className={`border rounded-lg p-3 sm:p-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors group ${
                          selectedContacts.includes(contact._id)
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact._id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectContact(contact._id);
                             }}
                             onClick={(e) => e.stopPropagation()}
                             aria-label={`Select ${contact.name}`}
                            className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                          />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-left flex-1">
                            <div className="font-semibold text-gray-900 truncate text-sm sm:text-base mb-0.5">
                            {contact.name}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate">
                            {contact.email}
                              </div>
                            </div>
                          </div>
                          {contact.identification && (
                              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                              {contact.identification.verified && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  Verified
                                </span>
                              )}
                              {contact.identification.active !== false && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Active
                                </span>
                              )}
                              {contact.identification.primary && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                  Primary
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                             onClick={(e) => {
                               e.stopPropagation();
                               openDeleteDialog(contact, "list");
                             }}
                             aria-label={`Delete ${contact.name}`}
                             title="Delete contact"
                            className="ml-2 text-red-500 hover:text-red-700 active:text-red-800 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-xs font-medium px-2 py-1 rounded hover:bg-red-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - AI Chat Assistant */}
          <div className="lg:col-span-2 order-2 space-y-4 sm:space-y-6 flex flex-col min-h-0">
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100 flex flex-col h-[70svh] min-h-[30rem] lg:h-[calc(100vh-180px)] lg:max-h-[calc(100vh-180px)]">
              {/* Chat Header */}
              <div className="border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold text-base shadow-sm">
                      AI
                  </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                        AI Email Automation
                      </h2>
                      <p className="text-xs text-gray-500">Crafting thoughtful communication in seconds</p>
                </div>
                    </div>
                  <div className="flex items-center gap-3 flex-wrap justify-start sm:justify-end">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
                        isGenerating
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                      {isGenerating ? "Composing reply" : "Online"}
                    </span>
                    {selectedContacts.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-emerald-600 font-semibold bg-emerald-50 px-2.5 sm:px-3 py-1.5 rounded-full border border-emerald-200">
                          {selectedContacts.length} selected
                        </span>
                      <button
                          onClick={() => setSelectedContacts([])}
                          className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1 rounded hover:bg-white/50 transition-colors"
                          title="Clear selection"
                        >
                          <FiX />
                      </button>
                  </div>
                )}
              </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 bg-gray-50"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                          : msg.isError
                          ? "bg-red-50 text-red-800 border border-red-200"
                          : "bg-white text-gray-800 shadow-sm border border-gray-200"
                      }`}
                    >
                      <div className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                      {msg.isLoading && (
                        <div className="flex gap-1 mt-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      )}
                      <div className="text-xs opacity-70 mt-1.5">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Draft Preview */}
                {currentDraft && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 sm:p-5 mt-3 sm:mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-800 flex items-center gap-2">
                        <FiFileText className="text-green-600" /> Email Draft
                      </h3>
                      <span className="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-full border border-green-200 w-fit">
                        Ready to send
                      </span>
                    </div>

                    {isEditingDraft ? (
                      <>
                        <div className="space-y-3 sm:space-y-4 mb-4 text-xs sm:text-sm">
                          <div>
                            <span className="font-medium text-gray-600">To:</span>{" "}
                            {currentDraft.isBulk && currentDraft.selectedContacts ? (
                              <span className="text-gray-800">
                                {currentDraft.selectedContacts.length} contact{currentDraft.selectedContacts.length !== 1 ? "s" : ""} ({currentDraft.selectedContacts.map(c => c.name).join(", ")})
                              </span>
                            ) : (
                              <>
                                <span className="text-gray-800">
                                  {currentDraft.employee?.name ||
                                    currentDraft.contact?.name ||
                                    "Recipient"}
                                </span>{" "}
                                <span className="text-gray-500">
                                  (
                                  {currentDraft.employee?.email ||
                                    currentDraft.contact?.email ||
                                    currentDraft.to}
                                  )
                                </span>
                              </>
                            )}
                          </div>
                          <div>
                            <label className="block font-medium text-gray-600 mb-2">
                              Subject:
                            </label>
                            <input
                              type="text"
                              value={editedDraft?.subject || ""}
                              onChange={(e) =>
                                setEditedDraft({
                                  ...editedDraft,
                                  subject: e.target.value,
                                })
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="Email subject"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block font-medium text-gray-600 mb-2 text-xs sm:text-sm">
                            Body:
                          </label>
                          <RichTextEditor
                            value={editedDraft?.body_html || ""}
                            onChange={handleBodyEditorChange}
                            placeholder="Enter email body..."
                            className="w-full"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                          <button
                            onClick={handleSaveDraftEdit}
                            disabled={!editedDraft?.subject?.trim() || !editedDraft?.body_html?.trim()}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 min-h-[44px] text-sm sm:text-base hover:shadow-lg"
                          >
                            <FiSave className="text-base" />
                            <span>Save Changes</span>
                          </button>
                          <button
                            onClick={handleCancelDraftEdit}
                            className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all min-h-[44px] text-sm sm:text-base flex items-center justify-center gap-2 hover:border-gray-400 hover:shadow-sm"
                          >
                            <FiX className="text-base" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-3 sm:space-y-4 mb-4 text-xs sm:text-sm">
                          <div>
                            <span className="font-medium text-gray-600">To:</span>{" "}
                            {currentDraft.isBulk && currentDraft.selectedContacts ? (
                              <span className="text-gray-800">
                                {currentDraft.selectedContacts.length} contact{currentDraft.selectedContacts.length !== 1 ? "s" : ""} ({currentDraft.selectedContacts.map(c => c.name).join(", ")})
                              </span>
                            ) : (
                              <>
                                <span className="text-gray-800">
                                  {currentDraft.employee?.name ||
                                    currentDraft.contact?.name ||
                                    "Recipient"}
                                </span>{" "}
                                <span className="text-gray-500">
                                  (
                                  {currentDraft.employee?.email ||
                                    currentDraft.contact?.email ||
                                    currentDraft.to}
                                  )
                                </span>
                              </>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">
                              Subject:
                            </span>{" "}
                            <span className="text-gray-800">
                              {currentDraft.subject}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 max-h-48 sm:max-h-60 overflow-y-auto">
                          <div
                            className="prose prose-sm max-w-none text-gray-700"
                            dangerouslySetInnerHTML={{
                              __html: currentDraft.body_html,
                            }}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                          <button
                            onClick={handleSendEmail}
                            disabled={sendStatus.includes("Sending")}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 active:from-green-800 active:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 min-h-[44px] text-sm sm:text-base hover:shadow-lg"
                          >
                            {sendStatus.includes("Sending") ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Sending...</span>
                              </>
                            ) : sendStatus ? (
                              <>
                                <FiCheck className="text-base" />
                                <span>{sendStatus}</span>
                              </>
                            ) : (
                              <>
                                <FiSend className="text-base" />
                                <span>
                                  {currentDraft.isBulk && currentDraft.selectedContacts
                                    ? `Send to ${currentDraft.selectedContacts.length} Contact${currentDraft.selectedContacts.length !== 1 ? "s" : ""}`
                                    : "Send Email"}
                                </span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleEditDraft}
                            className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all min-h-[44px] text-sm sm:text-base flex items-center justify-center gap-2 hover:border-gray-400 hover:shadow-sm"
                          >
                            <FiEdit className="text-base" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={handleCancelDraft}
                            className="px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all min-h-[44px] text-sm sm:text-base flex items-center justify-center gap-2 hover:border-gray-400 hover:shadow-sm"
                          >
                            <FiX className="text-base" />
                            <span>Cancel</span>
                          </button>
                        </div>
                        {smtpConfigError && (
                          <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 space-y-1">
                            <p>{smtpConfigError.message}</p>
                            {smtpConfigError.missingFields?.length > 0 && (
                              <p className="text-xs text-yellow-700">
                                Missing: {smtpConfigError.missingFields.join(", ")}
                              </p>
                            )}
                            <Link
                              href={smtpConfigError.setupPath || "/email-settings"}
                              className="text-emerald-600 underline"
                            >
                              Configure Email & SMTP settings
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-white rounded-b-xl">
                <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-w-0 flex-1 border border-gray-300 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={isGenerating}
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isGenerating}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md min-w-[80px] sm:min-w-[100px] min-h-[44px] text-sm sm:text-base"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : (
                      "Send"
                    )}
                  </button>
                </form>
                <p className="text-xs text-gray-400 mt-2 px-1 hidden sm:block">
                  <FiInfo className="mr-1 inline" />
                  Tip: Mention or select the employee name and what you want to communicate. The AI will generate a professional email.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {deleteDialog.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm" onClick={deleteDialog.loading ? undefined : closeDeleteDialog}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-4 sm:p-6 space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg">
                !
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {deleteDialog.mode === "bulk"
                    ? `Delete ${deleteDialog.selectedIds.length} contact${deleteDialog.selectedIds.length !== 1 ? "s" : ""}?`
                    : `Delete ${deleteDialog.contact?.name || "this contact"}?`}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {deleteDialog.mode === "bulk"
                    ? "This will permanently remove all selected contacts. This action cannot be undone."
                    : deleteDialog.contact?.email
                    ? `Are you sure you want to remove ${deleteDialog.contact.name} (${deleteDialog.contact.email}) from your contact list?`
                    : "Are you sure you want to remove this contact from your list?"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeDeleteDialog}
                disabled={deleteDialog.loading}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteContact}
                disabled={deleteDialog.loading}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteDialog.loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
    </div>
  );
}
