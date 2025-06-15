"use client";

import { AnchorProvider, Program } from "@project-serum/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useEffect, useReducer, useState } from "react";

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
  const [editNote, setEditNote] = useState<any>(null);

  const getProgram = () => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new AnchorProvider(connection, wallet as any, {});
    return new Program(IDL as any, PROGRAM_ID, provider);
  };

  const getNoteAddress = (title: String) => {
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
      setMessage("Error loading the notes");
    }
    setLoading(false);
  };

  /// createnote

  const creatNote = async () => {
    if (!title.trim() || !content.trim()) {
      setMessage("Please fill the title and content");
      return;
    }

    if (title.length > 100) {
      setMessage("Title too long (Max length: 100 chars)");
      return;
    }

    if (content.length > 1000) {
      setMessage("Content too long (Max length: 1000 chars)");
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

      setMessage("Note create successfully!");
      setTitle("");
      setContent("");
      await loadNotes();
    } catch (error) {
      console.log("Error creating note", error);
      setMessage("Error creating note");
    }
    setCreateLoading(false);
  };
  // update note

  const updateNote = async (note: any) => {
    if (!editContent.trim()) {
      setMessage("Content cannot be empty");
      return;
    }

    if (editContent.length > 1000) {
      setMessage("Content too long (Max length: 1000 chars)");
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

      setMessage("Note updated successfully!");
      setEditContent("");
      setEditNote(null);
      await loadNotes();
    } catch (error) {
      console.log("Error update note", error);
      setMessage("Error updating note");
    }
    setUpdateLoading(false);
  };
  // delete note

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

      setMessage("Note deleted successfully!");
      await loadNotes();
    } catch (error) {
      console.log("Error deleting the note", error);
      setMessage("Error deleting the note");
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
      <div className="text-gray-700">
        Wallet Not Connected! Please Connect Your Wallet.
      </div>
    );
  }

  return (
    <div className="text-gray-700">
      <div className="mb-6">
        <h2 className="text-2xl mb-6">Create New Note</h2>
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
          <h2 className="text-2xl mb-6">Your Notes</h2>
          <div>
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
