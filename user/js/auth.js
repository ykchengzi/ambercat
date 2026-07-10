function bindRegisterEmailCode(form) {
    if (!form || form.dataset.emailCodeBound === '1') return;
    form.dataset.emailCodeBound = '1';
    var btn = form.querySelector('#sendRegisterCodeBtn');
    var emailInput = form.querySelector('#email');
    var csrfInput = form.querySelector('input[name="csrf"]');
    var timer = null;
    function startCooldown(seconds) {
        var left = Number(seconds) || 60;
        btn.disabled = true;
        btn.textContent = left + '秒后重发';
        if (timer) clearInterval(timer);
        timer = setInterval(function() {
            left -= 1;
            if (left <= 0) {
                clearInterval(timer);
                timer = null;
                btn.disabled = false;
                btn.textContent = '发送验证码';
                return;
            }
            btn.textContent = left + '秒后重发';
        }, 1000);
    }
    if (!btn || !emailInput || !csrfInput) return;
    btn.addEventListener('click', function() {
        if (btn.disabled) return;
        var email = emailInput.value.trim();
        if (!email) {
            showToast('请先填写邮箱地址', 'error');
            emailInput.focus();
            return;
        }
        btn.disabled = true;
        btn.textContent = '发送中...';
        var fd = new FormData();
        fd.append('csrf', csrfInput.value);
        fd.append('email', email);
        fetch('api/index.php?action=send_register_code', { method: 'POST', body: fd })
            .then(function(r) {
                return r.text().then(function(text) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(text ? text.slice(0, 160) : 'empty response');
                    }
                });
            })
            .then(function(res) {
                if (res.status === 'success') {
                    showToast(res.message || '验证码已发送', 'success');
                    startCooldown(res.cooldown || 60);
                } else {
                    showToast(res.message || '验证码发送失败', 'error');
                    if (res.cooldown) startCooldown(res.cooldown);
                    else {
                        btn.disabled = false;
                        btn.textContent = '发送验证码';
                    }
                }
            })
            .catch(function(err) {
                console.error('验证码请求失败:', err);
                showToast('服务器返回异常，请稍后重试或联系管理员', 'error');
                btn.disabled = false;
                btn.textContent = '发送验证码';
            });
    });
}

function bindResetEmailCode(form) {
    if (!form || form.dataset.resetCodeBound === '1') return;
    form.dataset.resetCodeBound = '1';
    var btn = form.querySelector('#sendResetCodeBtn');
    var emailInput = form.querySelector('#email');
    var csrfInput = form.querySelector('input[name="csrf"]');
    var timer = null;
    function startCooldown(seconds) {
        var left = Number(seconds) || 60;
        btn.disabled = true;
        btn.textContent = left + '秒后重发';
        if (timer) clearInterval(timer);
        timer = setInterval(function() {
            left -= 1;
            if (left <= 0) {
                clearInterval(timer);
                timer = null;
                btn.disabled = false;
                btn.textContent = '发送验证码';
                return;
            }
            btn.textContent = left + '秒后重发';
        }, 1000);
    }
    if (!btn || !emailInput || !csrfInput) return;
    btn.addEventListener('click', function() {
        if (btn.disabled) return;
        var email = emailInput.value.trim();
        if (!email) {
            showToast('请先填写邮箱地址', 'error');
            emailInput.focus();
            return;
        }
        btn.disabled = true;
        btn.textContent = '发送中...';
        var fd = new FormData();
        fd.append('csrf', csrfInput.value);
        fd.append('email', email);
        fetch('api/index.php?action=send_reset_code', { method: 'POST', body: fd })
            .then(function(r) {
                return r.text().then(function(text) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(text ? text.slice(0, 160) : 'empty response');
                    }
                });
            })
            .then(function(res) {
                if (res.status === 'success') {
                    showToast(res.message || '验证码已发送', 'success');
                    startCooldown(res.cooldown || 60);
                } else {
                    showToast(res.message || '验证码发送失败', 'error');
                    if (res.cooldown) startCooldown(res.cooldown);
                    else {
                        btn.disabled = false;
                        btn.textContent = '发送验证码';
                    }
                }
            })
            .catch(function(err) {
                console.error('重置验证码请求失败:', err);
                showToast('服务器返回异常，请稍后重试或联系管理员', 'error');
                btn.disabled = false;
                btn.textContent = '发送验证码';
            });
    });
}

function bindDeleteAccountForm(form) {
    if (!form || form.dataset.deleteAccountBound === '1') return;
    form.dataset.deleteAccountBound = '1';

    var sendBtn = form.querySelector('#sendDeleteAccountCodeBtn');
    var openModalBtn = form.querySelector('#openDeleteModal');
    var emailInput = form.querySelector('#delete_email');
    var codeInput = form.querySelector('#delete_email_code');
    var passwordInput = form.querySelector('#delete_password');
    var csrfInput = form.querySelector('input[name="csrf"]');
    var hiddenConsequence = form.querySelector('#hiddenConfirmConsequence');
    var hiddenConfirmText = form.querySelector('#hiddenConfirmText');
    var cooldownBar = document.getElementById('deleteCooldownBar');
    var cooldownTextEl = document.getElementById('deleteCooldownText');
    var cooldownFill = document.getElementById('deleteCooldownFill');
    var modal = document.getElementById('deleteModalWrap');
    var closeModalBtn = document.getElementById('closeDeleteModal');
    var modalCheck = document.getElementById('modalConfirmCheck');
    var modalTextInput = document.getElementById('modalConfirmText');
    var modalCooldownEl = document.getElementById('modalCooldownDisplay');
    var modalCooldownText = document.getElementById('modalCooldownText');
    var finalBtn = document.getElementById('finalDeleteBtn');

    var resendTimer = null;
    var cooldownTimer = null;
    var cooldownTotal = 0;
    var cooldownLeft = 0;
    var codeSent = false;

    function startResendCooldown(seconds) {
        var left = Number(seconds) || 60;
        sendBtn.disabled = true;
        sendBtn.textContent = left + ' 秒后重发';
        if (resendTimer) clearInterval(resendTimer);
        resendTimer = setInterval(function() {
            left--;
            if (left <= 0) {
                clearInterval(resendTimer);
                resendTimer = null;
                sendBtn.disabled = false;
                sendBtn.textContent = '发送验证码';
                return;
            }
            sendBtn.textContent = left + ' 秒后重发';
        }, 1000);
    }

    function updateCooldownUI() {
        var pct = cooldownTotal > 0 ? ((cooldownTotal - cooldownLeft) / cooldownTotal * 100) : 100;
        if (cooldownFill) cooldownFill.style.width = pct + '%';
        if (cooldownLeft > 0) {
            if (cooldownTextEl) cooldownTextEl.textContent = '冷静时间：还剩 ' + cooldownLeft + ' 秒';
            if (cooldownBar) { cooldownBar.classList.add('counting'); cooldownBar.classList.remove('done'); }
            if (modalCooldownEl) { modalCooldownEl.classList.add('counting'); modalCooldownEl.classList.remove('done'); }
            if (modalCooldownText) modalCooldownText.textContent = '请等待冷静时间结束：还剩 ' + cooldownLeft + ' 秒';
        } else {
            if (cooldownTextEl) cooldownTextEl.textContent = '冷静时间已结束，可以继续';
            if (cooldownBar) { cooldownBar.classList.remove('counting'); cooldownBar.classList.add('done'); }
            if (modalCooldownEl) { modalCooldownEl.classList.remove('counting'); modalCooldownEl.classList.add('done'); }
            if (modalCooldownText) modalCooldownText.textContent = '冷静时间已结束，请再次确认后提交';
        }
        updateModalBtn();
    }

    function startDeleteCooldown(seconds) {
        cooldownTotal = Number(seconds) || 10;
        cooldownLeft = cooldownTotal;
        codeSent = true;
        if (cooldownFill) cooldownFill.style.width = '0%';
        updateCooldownUI();
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = setInterval(function() {
            cooldownLeft--;
            if (cooldownLeft <= 0) { cooldownLeft = 0; clearInterval(cooldownTimer); cooldownTimer = null; }
            updateCooldownUI();
        }, 1000);
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            if (sendBtn.disabled) return;
            var email = emailInput ? emailInput.value.trim() : '';
            if (!email) { showToast('请先填写绑定邮箱', 'error'); if (emailInput) emailInput.focus(); return; }
            sendBtn.disabled = true;
            sendBtn.textContent = '发送中...';
            var fd = new FormData();
            fd.append('csrf', csrfInput ? csrfInput.value : '');
            fd.append('email', email);
            fetch('api/index.php?action=send_delete_account_code', { method: 'POST', body: fd })
                .then(function(r) { return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error(t ? t.slice(0, 160) : 'empty'); } }); })
                .then(function(res) {
                    if (res.status === 'success') {
                        showToast(res.message || '注销验证码已发送', 'success');
                        startResendCooldown(res.cooldown || 60);
                        startDeleteCooldown(res.delete_cooldown || 30);
                    } else {
                        showToast(res.message || '验证码发送失败', 'error');
                        if (res.cooldown) startResendCooldown(res.cooldown);
                        else { sendBtn.disabled = false; sendBtn.textContent = '发送验证码'; }
                    }
                })
                .catch(function(err) {
                    console.error('注销验证码请求失败:', err);
                    showToast('服务器返回异常，请稍后重试', 'error');
                    sendBtn.disabled = false;
                    sendBtn.textContent = '发送验证码';
                });
        });
    }

    function openModal() {
        if (!modal) return;
        if (modalCheck) modalCheck.checked = false;
        if (modalTextInput) modalTextInput.value = '';
        updateCooldownUI();
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            if (!codeSent) { showToast('请先发送验证码', 'error'); return; }
            if (!codeInput || !codeInput.value.trim()) { showToast('请输入邮箱验证码', 'error'); return; }
            if (!passwordInput || !passwordInput.value.trim()) { showToast('请输入当前密码', 'error'); return; }
            openModal();
        });
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
    });

    function updateModalBtn() {
        if (!finalBtn) return;
        var ok = (modalCheck && modalCheck.checked)
            && (modalTextInput && modalTextInput.value.trim() === '确认注销')
            && cooldownLeft <= 0 && codeSent;
        finalBtn.disabled = !ok;
    }

    if (modalCheck) modalCheck.addEventListener('change', updateModalBtn);
    if (modalTextInput) modalTextInput.addEventListener('input', updateModalBtn);

    if (finalBtn) {
        finalBtn.addEventListener('click', function() {
            if (finalBtn.disabled) return;
            if (hiddenConsequence) hiddenConsequence.value = '1';
            if (hiddenConfirmText) hiddenConfirmText.value = '确认注销';
            var origHtml = finalBtn.innerHTML;
            finalBtn.disabled = true;
            finalBtn.innerHTML = '<span class="btn-spinner"></span>注销中...';
            var fd = new FormData(form);
            fetch('api/index.php?action=delete_account', { method: 'POST', body: fd })
                .then(function(r) { return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { throw new Error(t ? t.slice(0, 200) : 'empty'); } }); })
                .then(function(res) {
                    if (res.status === 'success') {
                        closeModal();
                        showToast(res.message || '账号已注销', 'success');
                        setTimeout(function() { window.location.href = res.redirect || '../index.html'; }, 1800);
                    } else {
                        showToast(res.message || '注销失败，请重试', 'error');
                        finalBtn.disabled = false;
                        finalBtn.innerHTML = origHtml;
                    }
                })
                .catch(function(err) {
                    console.error('注销请求失败:', err);
                    showToast('服务器返回异常，请稍后重试', 'error');
                    finalBtn.disabled = false;
                    finalBtn.innerHTML = origHtml;
                });
        });
    }
}
