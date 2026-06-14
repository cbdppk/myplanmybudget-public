export type OfflineOperationType =
  | "quick_expense_create"
  | "note_create"
  | "reminder_create"
  | "note_set_pinned"
  | "reminder_set_done";

export type QueuedQuickExpensePayload = {
  kind?: "BASELINE" | "EXTRA";
  type?: "INCOME" | "EXPENSE" | "SAVINGS";
  extraType?: "EXTRA_INCOME" | "EXTRA_EXPENSE" | "EXTRA_SAVINGS";
  amount: number;
  memo?: string;
  category?: string;
  occurredAt?: string;
  recurring?: boolean;
};

export type QueuedNotePayload = {
  title?: string;
  content: string;
};

export type QueuedReminderPayload = {
  title: string;
  dueAt: string;
};

export type QueuedNoteSetPinnedPayload = {
  noteId: string;
  pinned: boolean;
};

export type QueuedReminderSetDonePayload = {
  reminderId: string;
  done: boolean;
};

export type OfflineOperationPayloadMap = {
  quick_expense_create: QueuedQuickExpensePayload;
  note_create: QueuedNotePayload;
  reminder_create: QueuedReminderPayload;
  note_set_pinned: QueuedNoteSetPinnedPayload;
  reminder_set_done: QueuedReminderSetDonePayload;
};

export type OfflineOperation = {
  id: string;
  queuedAt: string;
  type: OfflineOperationType;
  payload: OfflineOperationPayloadMap[OfflineOperationType];
};

const DB_NAME = "myplanmybudget-offline";
const STORE_NAME = "offline-operation-queue";
const DB_VERSION = 1;

function isClient() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isClient()) {
      reject(new Error("IndexedDB unavailable in this environment."));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB."));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function requestValue<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
  });
}

export async function enqueueOfflineOperation<T extends OfflineOperationType>(type: T, payload: OfflineOperationPayloadMap[T]) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    type,
    payload,
  } satisfies OfflineOperation);
  await txDone(tx);
}

export async function listOfflineOperations(): Promise<OfflineOperation[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).getAll();
  const rows = await requestValue(req);
  await txDone(tx);
  return (rows as OfflineOperation[]).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function getOfflineQueueCount(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).count();
  const count = await requestValue(req);
  await txDone(tx);
  return count;
}

export async function clearOfflineOperations(ids: string[]) {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  for (const id of ids) {
    store.delete(id);
  }
  await txDone(tx);
}

export async function flushOfflineOperations() {
  const queued = await listOfflineOperations();
  if (queued.length === 0) return { processed: 0, failed: 0 };

  let data:
    | {
        processed: string[];
        failed: Array<{ id: string; reason: string }>;
      }
    | null = null;
  let lastError: Error | null = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operations: queued.map((item) => ({
            id: item.id,
            type: item.type,
            payload: item.payload,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Offline sync request failed with status ${response.status}.`);
      }

      data = (await response.json()) as {
        processed: string[];
        failed: Array<{ id: string; reason: string }>;
      };
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Offline sync failed.");
      if (attempt < maxAttempts) {
        const delayMs = 300 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!data) {
    throw lastError ?? new Error("Offline sync failed.");
  }

  await clearOfflineOperations(data.processed);
  return {
    processed: data.processed.length,
    failed: data.failed.length,
    failedItems: data.failed,
  };
}

// Backward-compatible wrappers used by current track feature code.
export async function enqueueQuickExpense(payload: QueuedQuickExpensePayload) {
  return enqueueOfflineOperation("quick_expense_create", payload);
}

export async function listQueuedQuickExpenses() {
  const rows = await listOfflineOperations();
  return rows.filter((item) => item.type === "quick_expense_create");
}

export async function getQuickExpenseQueueCount() {
  const rows = await listOfflineOperations();
  return rows.filter((item) => item.type === "quick_expense_create").length;
}

export async function clearQueuedQuickExpenses(ids: string[]) {
  return clearOfflineOperations(ids);
}

export async function flushQueuedQuickExpenses() {
  return flushOfflineOperations();
}
