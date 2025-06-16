"use client";

import { AnchorProvider, Program } from "@project-serum/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useEffect, useState } from "react";

const PROGRAM_ID = new PublicKey("nJiToJCPGNjxQ3Q6ySWgLqEX1AybLhaJu6niQdBxosK");

const IDL = {
  version: "0.1.0",
  name: "notes_dapp",
  instructions: [
    {
      name: "createNote",
      accounts: [
        { name: "note", isMut: true, isSigner: false },
        { name: "author", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "title", type: "string" },
        { name: "content", type: "string" },
      ],
    },
    {
      name: "updateNote",
      accounts: [
        { name: "note", isMut: true, isSigner: false },
        { name: "author", isMut: false, isSigner: true },
      ],
      args: [{ name: "content", type: "string" }],
    },
    {
      name: "deleteNote",
      accounts: [
        { name: "note", isMut: true, isSigner: false },
        { name: "author", isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Note",
      type: {
        kind: "struct",
        fields: [
          { name: "author", type: "publicKey" },
          { name: "title", type: "string" },
          { name: "content", type: "string" },
          { name: "createdAt", type: "i64" },
          { name: "lastUpdated", type: "i64" },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "TitleTooLong",
      msg: "Title cannot be longer than 100 chars",
    },
    {
      code: 6001,
      name: "ContentTooLong",
      msg: "Content cannot be longer than 1000 chars",
    },
    { code: 6002, name: "TitleEmpty", msg: "Title cannot be empty" },
    { code: 6003, name: "ContentEmpty", msg: "Content cannot be empty" },
    { code: 6004, name: "Unauthorized", msg: "Unauthorized" },
  ],
};

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();

  /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
  const [notes, setNotes] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deletingNoteTitle, setDeletingNoteTitle] = useState("");

  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editContent, setEditContent] = useState("");
  /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
  const [editNote, setEditNote] = useState<any>(null);

  const getProgram = () => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
    const provider = new AnchorProvider(connection, wallet as any, {});
    /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
    return new Program(IDL as any, PROGRAM_ID, provider);
  };

  const getNoteAddress = (title: string) => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const [noteAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("note"), wallet.publicKey.toBuffer(), Buffer.from(title)],
      PROGRAM_ID
    );
    return noteAddress;
  };

  // loadnotes
  const loadNotes = async () => {
    if (!wallet.publicKey) return;

    setLoading(true);
    try {
      const program = getProgram();
      if (!program) return;

      const notes = await program.account.note.all([
        {
          memcmp: {
            offset: 8, // account:Note:{author, title, con.....}
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      setNotes(notes);
      setMessage("");
    } catch (error) {
      console.log("Error loading notes", error);
    }
    setLoading(false);
  };

  /// createnote

  const creatNote = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage("❌ Please fill in both title and content");
      return;
    }

    if (title.length > 100) {
      setMessage("❌ Title too long (max 100 characters)");
      return;
    }

    if (content.length > 1000) {
      setMessage("❌ Content too long (max 1000 characters)");
      return;
    }
    setCreateLoading(true);
    try {
      const program = getProgram();
      if (!program) return;

      const noteAddress = getNoteAddress(title);
      if (!noteAddress) return;

      await program.methods
        .createNote(title, content)
        .accounts({
          note: noteAddress,
          author: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setMessage("✅ Note created successfully!");
      setTitle("");
      setContent("");
      await loadNotes();
    } catch (error) {
      console.log("Error creating note", error);
      setMessage("✅ Note created successfully!");
    }
    setCreateLoading(false);
  };
  // update note

  /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
  const updateNote = async (note: any) => {
    if (!editContent.trim()) {
      setMessage("❌ Content cannot be empty");
      return;
    }

    if (editContent.length > 1000) {
      setMessage("❌ Content too long (max 1000 characters)");
      return;
    }

    setUpdateLoading(true);
    try {
      const program = getProgram();
      if (!program) return;

      const noteAddress = getNoteAddress(note.account.title);
      if (!noteAddress) return;

      await program.methods
        .updateNote(editContent)
        .accounts({ note: noteAddress, author: wallet.publicKey })
        .rpc();

      setMessage("✅ Note updated successfully!");
      setEditContent("");
      setEditNote(null);
      await loadNotes();
    } catch (error) {
      console.log("Error update note", error);
      setMessage("❌ Error updating note");
    }
    setUpdateLoading(false);
  };
  // delete note

  /*eslint-disable-next-line @typescript-eslint/no-explicit-any*/
  const deleteNote = async (note: any) => {
    setDeleteLoading(true);
    try {
      const program = getProgram();
      if (!program) return;

      const noteAddress = getNoteAddress(note.account.title);
      if (!noteAddress) return;

      await program.methods
        .deleteNote()
        .accounts({ note: noteAddress, author: wallet.publicKey })
        .rpc();

      setMessage("✅ Note deleted successfully!");
      await loadNotes();
    } catch (error) {
      console.log("Error deleting the note", error);
      setMessage("❌ Error deleting note");
    }
    setDeleteLoading(false);
    setDeletingNoteTitle("");
  };

  useEffect(() => {
    if (wallet.connected) {
      loadNotes();
    }
  }, [wallet.connected]);

  if (!wallet.connected) {
    return (
      <div className="flex flex-col items-center justify-center p-8  border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Wallet Not Connected
          </h3>
          <p className="text-sm text-slate-600 max-w-md">
            Please connect your wallet to access this feature and interact with
            the application.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <svg
            className="w-4 h-4 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="text-xs text-amber-700 font-medium">
            Connection Required
          </span>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">
            Don't have a wallet? Get Phantom Wallet:
          </p>
          <a
            href="https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Install from Chrome Web Store
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-700">
      {message && (
        <div
          className={`p-3 mb-5 rounded-lg border ${
            message.includes("✅")
              ? "bg-green-100 border-green-300 text-green-800"
              : "bg-red-100 border-red-300 text-red-800"
          }`}
        >
          {message}
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-2xl mb-6 font-medium">Create New Note</h2>
        <div className="mb-4">
          <label className="text-sm block font-medium">
            Title ({title.length}/100)
          </label>
          <input
            type="text"
            name="title"
            value={title}
            placeholder="Title here..."
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            className="border-2 border-gray-300 rounded-lg p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label className="text-sm block font-medium">
            Content ({content.length}/1000)
          </label>
          <textarea
            maxLength={1000}
            name="content"
            value={content}
            rows={5}
            placeholder="Content here..."
            onChange={(e) => {
              setContent(e.target.value);
            }}
            className="border-2 border-gray-300 rounded-lg p-2 w-full"
          />
        </div>
        <button
          onClick={creatNote}
          disabled={createLoading || !title.trim() || !content.trim()}
          className="w-full bg-blue-500 rounded-lg text-white px-4 py-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {createLoading ? "Creating note.." : "Create Note"}
        </button>
      </div>

      {loading ? (
        <div>Loading your notes...</div>
      ) : (
        <div>
          <h2 className="text-2xl mb-6 font-medium">Your Notes</h2>
          <div>
            {/*eslint-disable-next-line @typescript-eslint/no-explicit-any*/}
            {notes?.map((note: any) => {
              return (
                <div
                  className="mb-6 border-2 border-gray-300 rounded-lg p-2"
                  key={note.account.title}
                >
                  <h3 className="text-xl font-bold">{note.account.title}</h3>
                  <p className="">{note.account.content}</p>
                  <div className="text-sm text-gray-500">
                    Created At:{" "}
                    {new Date(
                      note.account.createdAt.toNumber()
                    ).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    Last Updated:{" "}
                    {new Date(
                      note.account.createdAt.toNumber()
                    ).toLocaleString()}
                  </div>

                  {editNote ? (
                    <div>
                      <textarea
                        name="update_content"
                        value={editContent}
                        maxLength={1000}
                        rows={5}
                        placeholder="Content here..."
                        onChange={(e) => {
                          setEditContent(e.target.value);
                        }}
                        className="border-2 border-gray-300 rounded-lg p-2 w-full"
                      />
                      <button
                        onClick={() => {
                          updateNote(note);
                        }}
                        disabled={updateLoading}
                        className="p-2 text-white bg-blue-600 rounded-lg"
                      >
                        {updateLoading ? "Updating.." : "Update"}
                      </button>
                    </div>
                  ) : null}

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => {
                        if (editNote) {
                          setEditNote(null);
                        } else {
                          setEditNote(note);
                          setEditContent(note.account.content);
                        }
                      }}
                      disabled={updateLoading}
                      className="p-2 text-white bg-green-600 rounded-lg"
                    >
                      {editNote ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={() => {
                        deleteNote(note);
                        setDeletingNoteTitle(note.account.title);
                      }}
                      disabled={
                        deleteLoading &&
                        note.account.title === deletingNoteTitle
                      }
                      className="p-2 text-white bg-red-600 rounded-lg disabled:cursor-not-allowed"
                    >
                      {deleteLoading && note.account.title === deletingNoteTitle
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
