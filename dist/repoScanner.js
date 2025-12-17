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
exports.collectRepositoryFiles = collectRepositoryFiles;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const ignore_1 = __importDefault(require("ignore"));
const istextorbinary_1 = require("istextorbinary");
const DEFAULT_EXCLUDES = [
    '.git/',
    'node_modules/',
    '.github/',
    '.vscode/',
    '.idea/',
    'dist/',
    'coverage/',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.bmp',
    '*.ico',
    '*.svg',
    '*.mp4',
    '*.mp3',
    '*.zip',
    '*.tar',
    '*.gz',
    '*.tgz',
    '*.7z',
    '*.lock',
];
async function collectRepositoryFiles(options) {
    const ig = (0, ignore_1.default)().add(DEFAULT_EXCLUDES).add(options.excludePatterns);
    const files = [];
    const normalizePath = (input) => {
        const normalized = path_1.default.normalize(input).replace(/\\/g, '/');
        if (normalized === '.' || normalized === './') {
            return '';
        }
        return normalized.replace(/^\.\//, '');
    };
    async function walk(relativeDir) {
        const absoluteDir = relativeDir ? path_1.default.join(options.root, relativeDir) : options.root;
        const entries = await promises_1.default.readdir(absoluteDir, { withFileTypes: true });
        for (const entry of entries) {
            const relativePath = path_1.default.join(relativeDir, entry.name);
            const normalized = normalizePath(relativePath);
            if (ig.ignores(normalized)) {
                continue;
            }
            const absoluteChild = path_1.default.join(options.root, relativePath);
            if (entry.isDirectory()) {
                if (ig.ignores(`${normalized}/`)) {
                    continue;
                }
                await walk(relativePath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const stats = await promises_1.default.stat(absoluteChild);
            if (stats.size > options.maxFileSizeBytes) {
                core.info(`Skipping ${normalized} (> ${options.maxFileSizeBytes} bytes).`);
                continue;
            }
            const buffer = await promises_1.default.readFile(absoluteChild);
            if ((0, istextorbinary_1.isBinary)(absoluteChild, buffer)) {
                core.info(`Skipping binary file ${normalized}.`);
                continue;
            }
            files.push({
                relativePath: normalized,
                size: buffer.length,
                content: buffer.toString('utf8'),
            });
        }
    }
    await walk('');
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return files;
}
