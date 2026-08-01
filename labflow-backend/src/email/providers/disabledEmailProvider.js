const createDisabledEmailProvider = () => ({
  provider: "disabled",

  async sendMessage() {
    return {
      provider: "disabled",
      accepted: false,
      skipped: true,
      messageId: null,
    };
  },
});

module.exports = {
  createDisabledEmailProvider,
};
