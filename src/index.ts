import { Transport } from "nodemailer";
import {
    ClientOptions,
    Header,
    Message,
    MessageSendingResponse,
} from "postmark/dist/client/models";
import { ServerClient } from "postmark";
import MailMessage from "nodemailer/lib/mailer/mail-message";
import { Address, AttachmentLike } from "nodemailer/lib/mailer";
import { Readable } from "stream";
import { readFileSync } from "fs";

const packageData = require("../package.json");

type PostmarkResponse =
    | { success: true; messageId: string; enevelope: MessageSendingResponse }
    | { success: false };

function parseAddress(address: string | Address): string {
    if (typeof address === "string") {
        return address;
    }

    return `${address.name} <${address.address}>`;
}

function extractAddress(
    address: string | Address | (string | Address)[]
): string {
    if (Array.isArray(address)) {
        return address.map((addr) => parseAddress(addr)).join(", ");
    } else {
        return parseAddress(address);
    }
}

function parseContent(content: string | Buffer | Readable | AttachmentLike) {
    if (typeof content === "string" || content instanceof Buffer) {
        return content;
    }

    if (content instanceof Readable) {
        return content.read();
    }

    if (content.content) {
        return parseContent(content.content);
    }

    if (content.path) {
        if (typeof content.path !== "string") {
            // TODO: implement one day
            throw new Error("non string content path is not supported");
        }
        return readFileSync(content.path);
    }

    throw new Error("failed to parse content");
}

export class PostmarkTransport implements Transport<PostmarkResponse> {
    private client: ServerClient;

    constructor(token: string, opts?: ClientOptions.Configuration) {
        this.client = new ServerClient(token, opts);
    }

    get name() {
        return packageData.name;
    }

    get version() {
        return packageData.version;
    }

    send(
        mail: MailMessage<PostmarkResponse>,
        callback: (err: Error | null, info: PostmarkResponse) => void
    ): void {
        mail.normalize((err, data) => {
            if (err) {
                return callback(err, { success: false });
            }

            if (!data) {
                return callback(new Error("missing data"), { success: false });
            }

            if (!data.from) {
                return callback(new Error("missing from field"), { success: false });
            }

            if (!data.subject) {
                return callback(new Error("missing subject field"), { success: false });
            }

            const message: Message = {
                From: extractAddress(data.from),
                Subject: data.subject,
            };

            if (data.cc) {
                message.Cc = extractAddress(data.cc);
            }

            if (data.to) {
                message.To = extractAddress(data.to);
            }

            if (data.bcc) {
                message.Bcc = extractAddress(data.bcc);
            }

            if (data.replyTo) {
                message.ReplyTo = extractAddress(data.replyTo);
            }

            if (data.headers) {
                if (Array.isArray(data.headers)) {
                    message.Headers = data.headers.map((h) => new Header(h.key, h.value));
                } else {
                    // TODO: implement this one day
                    return callback(new Error("non array headers are not supported"), {
                        success: false,
                    });
                }
            }

            if (data.html) {
                try {
                    message.HtmlBody = parseContent(data.html);
                } catch (err) {
                    return callback(err as Error, { success: false });
                }
            }

            if (data.text) {
                try {
                    message.TextBody = parseContent(data.text);
                } catch (err) {
                    return callback(err as Error, { success: false });
                }
            }

            if (data.attachments) {
                // TODO: implement one day
                // message.Attachments;
                return callback(new Error("attachments are not supported"), {
                    success: false,
                });
            }

            // TODO: implement all these one day
            // message.Tag;
            // message.Metadata;
            // message.TrackLinks;
            // message.TrackOpens;
            // message.MessageStream;

            this.client
                .sendEmail(message)
                .then((res) =>
                    callback(null, {
                        success: true,
                        messageId: res.MessageID,
                        enevelope: res,
                    })
                )
                .catch((err) => callback(err, { success: false }));
        });
    }
}
