import subprocess
import sys
import os
import os.path


def linux_licenses_text():
    package_docs = '/usr/share/doc/'
    licenses = []

    for name in os.listdir(package_docs):
        path = os.path.join(package_docs, name)

        if not os.path.isdir(path):
            print('WARNING {} is not a directory.'
                  .format(path), file=sys.stderr)
            continue

        cr = os.path.join(path, 'copyright')

        if not os.path.isfile(cr):
            print('WARNING {} is not an existing file'
                  .format(cr), file=sys.stderr)
            continue

        licenses.append(open(cr).read())

    return '\n\n'.join(licenses)


def node_modules_licenses_text():
    out = subprocess.check_output(["yarn", "licenses", "generate_disclaimer"])
    return out.decode('utf-8')


def generate_license_file():
    return (node_modules_licenses_text() +
            'The Freefall software is run on the following platform: ' +
            linux_licenses_text())


def main():
    print(generate_license_file())


if __name__ == '__main__':
    main()
