"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPromptFiles = loadPromptFiles;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
async function walkDirectory(root, current, results) {
    const currentPath = current ? path_1.default.join(root, current) : root;
    const entries = await promises_1.default.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
        const relativeChild = path_1.default.join(current, entry.name);
        const absoluteChild = path_1.default.join(root, relativeChild);
        if (entry.isDirectory()) {
            await walkDirectory(root, relativeChild, results);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (!entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }
        const content = await promises_1.default.readFile(absoluteChild, 'utf8');
        const normalizedRelative = path_1.default
            .relative(root, absoluteChild)
            .split(path_1.default.sep)
            .filter(Boolean)
            .join('/');
        results.push({
            absolutePath: absoluteChild,
            relativePath: normalizedRelative || entry.name,
            content,
        });
    }
}
async function loadPromptFiles(promptsFolder) {
    let stats;
    try {
        stats = await promises_1.default.stat(promptsFolder);
    }
    catch (error) {
        throw new Error(`Prompts folder not found at ${promptsFolder}`);
    }
    if (!stats.isDirectory()) {
        throw new Error(`Prompts folder path ${promptsFolder} is not a directory.`);
    }
    const prompts = [];
    await walkDirectory(promptsFolder, '', prompts);
    const filtered = prompts.filter((prompt) => prompt.relativePath.toLowerCase().endsWith('.md'));
    filtered.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (!filtered.length) {
        core.warning(`No .md prompt files found under ${promptsFolder}`);
    }
    return filtered;
}
