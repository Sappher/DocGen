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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGitCommand = runGitCommand;
exports.hasChanges = hasChanges;
exports.configureGitUser = configureGitUser;
exports.checkoutBranch = checkoutBranch;
exports.pushBranch = pushBranch;
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
async function runGitCommand(args, silent = false) {
    let output = '';
    let errorOutput = '';
    await (0, exec_1.exec)('git', args, {
        silent,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
            stderr: (data) => {
                errorOutput += data.toString();
            },
        },
    });
    if (errorOutput && !silent) {
        core.info(errorOutput);
    }
    return output.trim();
}
async function hasChanges() {
    const status = await runGitCommand(['status', '--porcelain'], true);
    return status.length > 0;
}
async function configureGitUser(name, email) {
    await runGitCommand(['config', 'user.name', name]);
    await runGitCommand(['config', 'user.email', email]);
}
async function checkoutBranch(branchName, baseRef) {
    if (baseRef) {
        await runGitCommand(['fetch', 'origin', baseRef]);
        await runGitCommand(['checkout', '-B', branchName, `origin/${baseRef}`]);
        return;
    }
    await runGitCommand(['checkout', '-B', branchName]);
}
async function pushBranch(branchName) {
    await runGitCommand(['push', 'origin', branchName, '--force-with-lease']);
}
