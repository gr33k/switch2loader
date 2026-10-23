import unittest
from ftplib import error_perm

from upload_nxhid_ftp import install


class FakeFtp:
    def __init__(self, files=None, corrupt_readback=False):
        self.cwd_path = "/"
        self.files = dict(files or {})
        self.corrupt_readback = corrupt_readback

    def cwd(self, folder):
        if folder == "/switch":
            self.cwd_path = folder
        elif folder == "nxhid" and self.cwd_path == "/switch":
            self.cwd_path = "/switch/nxhid"
        else:
            raise error_perm("550 No such folder")

    def mkd(self, folder):
        if folder != "nxhid":
            raise AssertionError("Unexpected directory")

    def retrbinary(self, command, callback):
        name = command.removeprefix("RETR ")
        if name not in self.files:
            raise error_perm("550 File missing")
        data = self.files[name]
        if self.corrupt_readback and name.startswith("nxhid.nro.upload-"):
            data += b"wrong"
        callback(data)

    def storbinary(self, command, stream):
        self.files[command.removeprefix("STOR ")] = stream.read()

    def rename(self, source, dest):
        self.files[dest] = self.files.pop(source)

    def delete(self, name):
        if name not in self.files:
            raise error_perm("550 File missing")
        del self.files[name]


class FtpInstallTests(unittest.TestCase):
    def test_new_install_reads_back_before_final_name(self):
        ftp = FakeFtp()
        result = install(ftp, b"verified-nro")
        self.assertEqual(result["status"], "installed")
        self.assertEqual(ftp.files, {"nxhid.nro": b"verified-nro"})

    def test_existing_file_is_backed_up(self):
        ftp = FakeFtp({"nxhid.nro": b"old"})
        result = install(ftp, b"verified-nro")
        self.assertEqual(ftp.files["nxhid.nro"], b"verified-nro")
        self.assertEqual(ftp.files[result["backup"]], b"old")

    def test_failed_readback_preserves_existing_file(self):
        ftp = FakeFtp({"nxhid.nro": b"old"}, corrupt_readback=True)
        with self.assertRaisesRegex(RuntimeError, "read-back differed"):
            install(ftp, b"verified-nro")
        self.assertEqual(ftp.files, {"nxhid.nro": b"old"})


if __name__ == "__main__":
    unittest.main()
