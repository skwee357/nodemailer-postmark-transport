# An (un)official Nodemailer transport for Postmark

## Install

```sh
npm install --save @skwee357/nodemailer-postmark-transport
```

## Usage

```js
const transport = new PostmarkTransport(env.POSTMARK_SERVER_TOKEN);
const mailer = createTransport(transport);
```
